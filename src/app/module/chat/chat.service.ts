import {
  HttpException,
  HttpStatus,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
export class ChatService {
  constructor(private readonly prisma: PrismaService) {}

  async getUsage(userId: string) {
    const now = new Date();
    const [subscription, user] = await Promise.all([
      this.prisma.userSubscription.findFirst({
        where: {
          userId,
          isActive: true,
          startsAt: { lte: now },
          endsAt: { gt: now },
        },
        orderBy: { endsAt: 'desc' },
        include: { subscription: { select: { id: true, name: true } } },
      }),
      this.prisma.user.findUnique({
        where: { id: userId },
        select: { creditBalance: true },
      }),
    ]);

    if (!user) throw new NotFoundException('User not found');

    return {
      subscription: subscription
        ? {
            id: subscription.subscription.id,
            name: subscription.subscription.name,
            messagesUsed: subscription.messagesUsed,
            messageLimit: subscription.messageLimit,
            messagesRemaining: Math.max(
              subscription.messageLimit - subscription.messagesUsed,
              0,
            ),
            endsAt: subscription.endsAt,
          }
        : null,
      creditBalance: user.creditBalance,
    };
  }

  async sendMessage(userId: string, companionId: string, message: string) {
    return this.prisma.$transaction(async (tx) => {
      const companion = await tx.companions.findFirst({
        where: { id: companionId, status: true },
        select: { id: true },
      });
      if (!companion) {
        throw new NotFoundException('Companion not found');
      }

      const now = new Date();
      const activeSubscription = await tx.userSubscription.findFirst({
        where: {
          userId,
          isActive: true,
          startsAt: { lte: now },
          endsAt: { gt: now },
        },
        orderBy: { endsAt: 'desc' },
      });
      if (!activeSubscription) {
        throw new HttpException(
          'An active subscription is required to chat',
          HttpStatus.PAYMENT_REQUIRED,
        );
      }

      const quotaUpdate = await tx.userSubscription.updateMany({
        where: {
          id: activeSubscription.id,
          messagesUsed: { lt: activeSubscription.messageLimit },
        },
        data: { messagesUsed: { increment: 1 } },
      });

      let usedCredit = false;
      if (quotaUpdate.count === 0) {
        const creditUpdate = await tx.user.updateMany({
          where: { id: userId, creditBalance: { gte: 1 } },
          data: { creditBalance: { decrement: 1 } },
        });
        if (creditUpdate.count === 0) {
          throw new HttpException(
            'Message limit reached. Buy credits to continue',
            HttpStatus.PAYMENT_REQUIRED,
          );
        }
        usedCredit = true;
      }

      const savedMessage = await tx.chatMessage.create({
        data: { userId, companionId, message, usedCredit },
      });

      const [subscription, user] = await Promise.all([
        tx.userSubscription.findUnique({
          where: { id: activeSubscription.id },
        }),
        tx.user.findUnique({
          where: { id: userId },
          select: { creditBalance: true },
        }),
      ]);

      if (usedCredit && user) {
        await tx.creditTransaction.create({
          data: {
            userId,
            companionId,
            direction: 'debit',
            reason: 'extra_message',
            amount: 1,
            balanceBefore: user.creditBalance + 1,
            balanceAfter: user.creditBalance,
            referenceId: savedMessage.id,
          },
        });
      }

      return {
        message: savedMessage,
        usage: {
          messagesUsed: subscription?.messagesUsed,
          messageLimit: subscription?.messageLimit,
          creditBalance: user?.creditBalance,
          chargedFrom: usedCredit ? 'wallet' : 'subscription',
        },
      };
    });
  }
}
