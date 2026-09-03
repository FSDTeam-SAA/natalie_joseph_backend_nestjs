import {
  HttpException,
  HttpStatus,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { CreditService } from '../credit/credit.service';

@Injectable()
export class ChatService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly creditService: CreditService,
  ) {}

  async getUsage(userId: string) {
    await this.prisma.$transaction((tx) =>
      this.creditService.expirePurchasedCredits(tx, userId),
    );
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
            creditAllowance: subscription.creditAllowance,
            creditsUsed: subscription.creditsUsed,
            subscriptionCreditsRemaining: Math.max(
              subscription.creditAllowance - subscription.creditsUsed,
              0,
            ),
            endsAt: subscription.endsAt,
          }
        : null,
      purchasedCredits: user.creditBalance,
      totalCredits:
        user.creditBalance +
        (subscription
          ? Math.max(subscription.creditAllowance - subscription.creditsUsed, 0)
          : 0),
      lowCredit:
        user.creditBalance +
          (subscription
            ? Math.max(
                subscription.creditAllowance - subscription.creditsUsed,
                0,
              )
            : 0) <=
        Math.max(10, Math.ceil((subscription?.creditAllowance ?? 0) * 0.1)),
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

      const charge = await this.creditService.consumeCredits(tx, userId, 1);
      if (!charge) {
        throw new HttpException(
          'Not enough credits. Buy credits to continue',
          HttpStatus.PAYMENT_REQUIRED,
        );
      }
      const usedCredit = charge.fromPurchased > 0;

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
            amount: charge.fromPurchased,
            balanceBefore: user.creditBalance + charge.fromPurchased,
            balanceAfter: user.creditBalance,
            referenceId: savedMessage.id,
          },
        });
      }

      return {
        message: savedMessage,
        usage: {
          creditsUsed: subscription?.creditsUsed,
          creditAllowance: subscription?.creditAllowance,
          subscriptionCreditsRemaining: subscription
            ? Math.max(
                subscription.creditAllowance - subscription.creditsUsed,
                0,
              )
            : 0,
          purchasedCredits: user?.creditBalance,
          creditBalance: user?.creditBalance,
          chargedFrom:
            charge.fromSubscription > 0 && charge.fromPurchased > 0
              ? 'subscription_and_purchased'
              : usedCredit
                ? 'purchased'
                : 'subscription',
        },
      };
    });
  }
}
