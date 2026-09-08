import { randomUUID } from 'crypto';
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
    return this.prisma.$transaction(async (tx) => {
      await this.creditService.expirePurchasedCredits(tx, userId);
      const now = new Date();
      const [subscription, user] = await Promise.all([
        tx.userSubscription.findFirst({
          where: {
            userId,
            isActive: true,
            startsAt: { lte: now },
            endsAt: { gt: now },
          },
          orderBy: { endsAt: 'desc' },
          include: { subscription: { select: { id: true, name: true } } },
        }),
        tx.user.findUnique({
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
        ...(await this.creditService.checkLowCredit(tx, userId)),
        creditBalance: user.creditBalance,
      };
    });
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
    type: 'text' | 'voice' = 'text',
  ) {
    message = message.trim();
    if (!message) throw new BadRequestException('Message must not be blank');
    return this.prisma.$transaction(
      async (tx) => {
        // Serialize this user's chat charges and conversation creation across instances.
        await tx.$queryRaw`SELECT id FROM users WHERE id = ${userId} FOR UPDATE`;
        const companion = await tx.companions.findFirst({
          where: { id: companionId, status: true },
        });
        if (!companion) throw new NotFoundException('Companion not found');

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

        const messageId = randomUUID();
        const costs = await this.creditService.getCosts(tx);
        const creditCost = type === 'voice' ? costs.voice : costs.message;
        const charge = await this.creditService.consumeCredits(
          tx,
          userId,
          creditCost,
          {
            reason: type === 'voice' ? 'voice' : 'extra_message',
            companionId,
            referenceId: messageId,
            message: true,
          },
        );
        if (!charge) {
          throw new HttpException(
            'Not enough credits. Buy credits to continue',
            HttpStatus.PAYMENT_REQUIRED,
          );
        }
        const usedCredit = charge.fromPurchased > 0;

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
        if (conversation.mode === 'ai' && !conversation.aiConversationId) {
          const remote = await this.aiApi.createConversation(
            aiCompanionId,
            authorization,
          );
          conversation = await tx.chatConversation.update({
            where: { id: conversation.id },
            data: { aiConversationId: remote.id },
          });
        }
        const reply =
          conversation.mode === 'human'
            ? null
            : await this.aiApi.sendMessage(
                conversation.aiConversationId!,
                aiCompanionId,
                message,
                authorization,
                messageId,
              );
        await tx.chatConversation.update({
          where: { id: conversation.id },
          data: { updatedAt: new Date() },
        });

        const savedMessage = await tx.chatMessage.create({
          data: {
            id: messageId,
            type,
            userId,
            companionId,
            message,
            usedCredit,
            creditCost,
            response: reply?.response ?? null,
            aiMessageId: reply?.message_id,
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

        await tx.relationship.upsert({
          where: { userId_companionId: { userId, companionId } },
          create: {
            userId,
            companionId,
            interactions: 1,
            lastInteractionAt: now,
          },
          update: { interactions: { increment: 1 }, lastInteractionAt: now },
        });

        return {
          mode: conversation.mode,
          message: savedMessage,
          response: reply?.response ?? null,
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
