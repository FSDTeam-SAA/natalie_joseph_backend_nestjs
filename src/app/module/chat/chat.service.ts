import {
  BadRequestException,
  HttpException,
  HttpStatus,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { AiApi } from '../../helper/ai/aiapi';
import { CreditService } from '../credit/credit.service';

@Injectable()
export class ChatService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly creditService: CreditService,
    private readonly aiApi: AiApi,
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

  async getMessages(userId: string, companionId: string, page = 1) {
    const [messages, total] = await Promise.all([
      this.prisma.chatMessage.findMany({
        where: { userId, companionId },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        skip: (page - 1) * 50,
        take: 50,
      }),
      this.prisma.chatMessage.count({ where: { userId, companionId } }),
    ]);
    return { messages: messages.reverse(), total, page, limit: 50 };
  }

  getConversations(userId: string) {
    return this.prisma.chatConversation.findMany({
      where: { userId },
      orderBy: { updatedAt: 'desc' },
      include: { companion: true },
    });
  }

  async sendMessage(
    userId: string,
    companionId: string,
    message: string,
    authorization: string,
  ) {
    message = message.trim();
    if (!message) throw new BadRequestException('Message must not be blank');
    return this.prisma.$transaction(
      async (tx) => {
        // Serialize this user's chat charges and conversation creation across instances.
        await tx.$queryRaw`SELECT id FROM users WHERE id = ${userId} FOR UPDATE`;
        const companion = await tx.companions.findFirst({
          where: { id: companionId, status: true },
          select: { id: true, aiCompanionId: true },
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

        // const aiCompanionId = companionId;
        const aiCompanionId = companion.aiCompanionId || companion.id;
        let conversation = await tx.chatConversation.findUnique({
          where: { userId_companionId: { userId, companionId } },
        });
        if (!conversation) {
          const remote = await this.aiApi.createConversation(
            aiCompanionId,
            authorization,
          );
          conversation = await tx.chatConversation.create({
            data: { userId, companionId, aiConversationId: remote.id },
          });
        }
        const reply = await this.aiApi.sendMessage(
          conversation.aiConversationId,
          aiCompanionId,
          message,
          authorization,
        );
        await tx.chatConversation.update({
          where: { id: conversation.id },
          data: { updatedAt: new Date() },
        });

        const savedMessage = await tx.chatMessage.create({
          data: {
            userId,
            companionId,
            message,
            usedCredit,
            creditCost: 1,
            response: reply.response,
            aiMessageId: reply.message_id,
            conversationId: conversation.id,
          },
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
          response: reply.response,
          conversationId: conversation.id,
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
      },
      { maxWait: 5000, timeout: 75000 },
    );
  }
}
