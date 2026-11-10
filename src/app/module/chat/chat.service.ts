import {
  BadRequestException,
  BadGatewayException,
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import { PrismaService } from 'src/prisma/prisma.service';
import { AiApi, AiReply, AiAudio } from '../../helper/ai/aiapi';
import { CreditService } from '../credit/credit.service';
import { LifestyleService } from '../lifestyle/lifestyle.service';
import { policy } from '../lifestyle/lifestyle-policy';
import { responseCost } from './response-cost';
import { photoIntent } from '../lifestyle/photo-intent';

@Injectable()
export class ChatService {
  private readonly logger = new Logger(ChatService.name);
  constructor(
    private readonly prisma: PrismaService,
    private readonly creditService: CreditService,
    private readonly aiApi: AiApi,
    private readonly lifestyle: LifestyleService,
  ) {}

  getAudio(media: NonNullable<AiReply['media']>, authorization: string) {
    return this.aiApi.getAudio(media, authorization);
  }

  async getUsage(userId: string) {
    const now = new Date();
    // A balance read must not acquire the wallet lock or hold an interactive
    // transaction while another request is waiting for an AI response.
    const [user, costs] = await Promise.all([
      this.prisma.user.findUnique({
        where: { id: userId },
        select: {
          creditBalance: true,
          purchasedCreditLots: {
            where: { expiresAt: { lte: now }, remainingAmount: { gt: 0 } },
            select: { remainingAmount: true },
          },
          subscriptions: {
            where: {
              isActive: true,
              startsAt: { lte: now },
              endsAt: { gt: now },
            },
            orderBy: { endsAt: 'desc' },
            take: 1,
            include: { subscription: { select: { id: true, name: true } } },
          },
        },
      }),
      this.creditService.getCosts(),
    ]);
    if (!user) throw new NotFoundException('User not found');
    const subscription = user.subscriptions[0];
    const expiredCredits = user.purchasedCreditLots.reduce(
      (sum, lot) => sum + lot.remainingAmount,
      0,
    );
    const purchasedCredits = Math.max(0, user.creditBalance - expiredCredits);
    const subscriptionCreditsRemaining = Math.max(
      0,
      (subscription?.creditAllowance ?? 0) - (subscription?.creditsUsed ?? 0),
    );
    const totalCredits = purchasedCredits + subscriptionCreditsRemaining;
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
            subscriptionCreditsRemaining,
            startsAt: subscription.startsAt,
            endsAt: subscription.endsAt,
            createdAt: subscription.createdAt,
          }
        : null,
      purchasedCredits,
      creditBalance: purchasedCredits,
      totalCredits,
      lowCredit: totalCredits <= costs.low_credit_threshold,
      threshold: costs.low_credit_threshold,
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
    type: 'text' | 'voice' = 'text',
    whatsappMessageKey?: string,
    audio?: () => Promise<AiAudio>,
  ) {
    message = message.trim();
    if (!message && !audio)
      throw new BadRequestException('Message must not be blank');
    if (message.length > 4000)
      throw new BadRequestException('Message must be at most 4000 characters');
    const started = Date.now();
    let lockedAt: number | undefined;
    let aiStartedAt: number | undefined;
    let aiFinishedAt: number | undefined;
    try {
      return await this.prisma.$transaction(
        async (tx) => {
          // Serialize this user's chat charges and conversation creation across instances.
          await tx.$queryRaw`SELECT id FROM users WHERE id = ${userId} FOR UPDATE`;
          lockedAt = Date.now();
          // A Meta retry must reuse the saved AI response without charging again.
          if (whatsappMessageKey) {
            const saved = await tx.chatMessage.findUnique({
              where: { whatsappMessageKey },
            });
            if (
              saved &&
              saved.userId === userId &&
              saved.companionId === companionId
            ) {
              const legacyPhoto =
                saved.message === '[Library photo request]' &&
                whatsappMessageKey.startsWith('library:') &&
                photoIntent(message);
              if (!audio && saved.message !== message && !legacyPhoto)
                throw new BadRequestException(
                  'This request ID was already used for another message',
                );
              return {
                message_type:
                  (saved.aiPayload as unknown as AiReply | null)
                    ?.message_type ?? 'text',
                media:
                  (saved.aiPayload as unknown as AiReply | null)?.media ?? null,
                transcript:
                  (saved.aiPayload as unknown as AiReply | null)?.transcript ??
                  null,
                response: saved.response,
                message: saved,
                conversationId: saved.conversationId,
              };
            }
          }
          const companion = await tx.companions.findFirst({
            where: { id: companionId, status: true },
            select: { id: true },
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
          const isTrial =
            policy(activeSubscription.entitlementPolicy).kind === 'trial';
          if (isTrial && (audio || type === 'voice'))
            throw new HttpException(
              'Voice is not included in the trial. Please choose a paid subscription.',
              403,
            );
          const enhanced = process.env.AI_RESPONSE_BILLING_ENABLED === 'true';
          const contextual =
            process.env.AI_LIFESTYLE_CONTEXT_ENABLED === 'true';
          await this.creditService.expirePurchasedCredits(tx, userId);
          const wallet = await tx.user.findUniqueOrThrow({
            where: { id: userId },
            select: { creditBalance: true, adultEligible: true },
          });
          const available =
            wallet.creditBalance +
            Math.max(
              0,
              activeSubscription.creditAllowance -
                activeSubscription.creditsUsed,
            );
          let conversation = await tx.chatConversation.findUnique({
            where: { userId_companionId: { userId, companionId } },
          });
          const photoRequest =
            !audio && type === 'text' && conversation?.mode !== 'human'
              ? photoIntent(message)
              : null;
          const upstreamMessage = photoRequest?.shareable
            ? `Send me a photo of yourself${photoRequest.tags.length ? `: ${photoRequest.tags.join(', ')}` : '.'}`
            : photoRequest?.prompt || message;
          if (upstreamMessage.length > 4000)
            throw new BadRequestException(
              'Please shorten your photo description to 3900 characters',
            );
          if (photoRequest && wallet.adultEligible !== true)
            throw new HttpException(
              'An approved adult user account is required for photos',
              403,
            );
          const libraryPhoto = photoRequest?.libraryEligible
            ? await this.lifestyle.matchPhoto(
                tx,
                userId,
                companionId,
                photoRequest.tags,
              )
            : null;
          if (isTrial && photoRequest && !libraryPhoto)
            throw new HttpException(
              'No matching approved photo is available. Custom AI images require a paid plan.',
              403,
            );
          const minimumCost = photoRequest
            ? costs.photo
            : enhanced
              ? Math.min(costs.message, costs.photo, costs.voice) +
                (audio ? costs.transcription : 0)
              : type === 'voice'
                ? costs.voice
                : costs.message;
          if (
            conversation?.mode !== 'human' &&
            !isTrial &&
            available < minimumCost
          )
            throw new HttpException(
              'Not enough credits. Buy credits to continue',
              402,
            );
          let creditCost = 0;
          if (isTrial && conversation?.mode !== 'human')
            await this.lifestyle.allowance(
              tx,
              activeSubscription,
              libraryPhoto ? 'included_photo' : 'trial_reply',
            );

          const aiCompanionId = companion.id;
          if (!conversation) {
            const remote = libraryPhoto
              ? null
              : await this.aiApi.createConversation(
                  aiCompanionId,
                  authorization,
                );
            conversation = await tx.chatConversation.create({
              data: { userId, companionId, aiConversationId: remote?.id },
            });
          }
          if (
            conversation.mode === 'ai' &&
            !conversation.aiConversationId &&
            !libraryPhoto
          ) {
            const remote = await this.aiApi.createConversation(
              aiCompanionId,
              authorization,
            );
            conversation = await tx.chatConversation.update({
              where: { id: conversation.id },
              data: { aiConversationId: remote.id },
            });
          }
          const inputAudio =
            audio && conversation.mode !== 'human' ? await audio() : undefined;
          // Share this user's own library-delivery context for continuity without
          // making a model call to persist a photo. Public lifestyle data is optional.
          const context =
            !libraryPhoto && conversation.mode !== 'human'
              ? {
                  version: 'lifestyle-v1',
                  recentSharedPhotos: await this.lifestyle.recentSharedPhotos(
                    tx,
                    userId,
                    companionId,
                  ),
                  ...(contextual
                    ? await this.lifestyle.context(companionId, tx)
                    : {}),
                  access: {
                    trial: isTrial,
                    allowed_output_types: isTrial
                      ? ['text']
                      : ['text', 'image', 'audio'],
                    available_credits: isTrial ? 0 : available,
                    prices: costs,
                    billing_mode: enhanced ? 'response' : 'legacy',
                    library_reuse: !!photoRequest?.shareable,
                  },
                }
              : undefined;
          aiStartedAt = Date.now();
          const reply: AiReply | null = libraryPhoto
            ? {
                message_id: messageId,
                conversation_id:
                  conversation.aiConversationId || conversation.id,
                companion_id: companionId,
                created_at: new Date().toISOString(),
                message_type: 'image',
                source: 'library',
                photo_tags: libraryPhoto.tags,
                response: libraryPhoto.caption,
                usage: { input_tokens: 0, output_tokens: 0 },
                media: {
                  id: libraryPhoto.id,
                  kind: 'image',
                  url: libraryPhoto.url,
                  mime_type: libraryPhoto.mimeType,
                  byte_size: 0,
                },
              }
            : conversation.mode === 'human'
              ? null
              : await this.aiApi.sendMessage(
                  conversation.aiConversationId!,
                  aiCompanionId,
                  upstreamMessage,
                  authorization,
                  whatsappMessageKey || messageId,
                  inputAudio,
                  context,
                  type === 'voice',
                );
          aiFinishedAt = Date.now();
          if (
            isTrial &&
            reply &&
            reply.message_type &&
            reply.message_type !== 'text' &&
            !libraryPhoto
          )
            throw new BadGatewayException(
              'AI returned content not permitted in trial',
            );
          if (reply && !isTrial)
            creditCost = enhanced
              ? responseCost(reply, !!inputAudio, costs)
              : reply.message_type === 'image'
                ? costs.photo
                : reply.message_type === 'audio' || type === 'voice'
                  ? costs.voice
                  : costs.message;
          const charge =
            reply && !isTrial
              ? await this.creditService.consumeCredits(
                  tx,
                  userId,
                  creditCost,
                  {
                    reason:
                      reply.message_type === 'image'
                        ? 'photo'
                        : reply.message_type === 'audio'
                          ? 'voice'
                          : 'extra_message',
                    companionId,
                    referenceId: messageId,
                    message: true,
                    lowCreditThreshold: costs.low_credit_threshold,
                  },
                )
              : null;
          if (reply && !isTrial && !charge)
            throw new HttpException(
              'Not enough credits for this response. Please add credits.',
              402,
            );
          if (reply?.message_type === 'image' && reply.media) {
            await this.lifestyle.recordPhotoView(
              tx,
              userId,
              companionId,
              reply.media.url,
              creditCost,
            );
            // Only generic, known-category prompts are eligible for shared-library review.
            // Custom/personal requests stay private to this user's conversation.
            if (!libraryPhoto && photoRequest?.shareable)
              await this.lifestyle.retainGeneratedPhoto(
                tx,
                companionId,
                reply,
                photoRequest.tags,
              );
          }
          const usedCredit = (charge?.fromPurchased ?? 0) > 0;
          await tx.chatConversation.update({
            where: { id: conversation.id },
            data: { updatedAt: new Date() },
          });

          const savedMessage = await tx.chatMessage.create({
            data: {
              id: messageId,
              whatsappMessageKey,
              type,
              userId,
              companionId,
              message: audio
                ? reply?.transcript || message || '[Voice message]'
                : message,
              usedCredit,
              creditCost,
              response: reply?.response ?? null,
              ...(reply
                ? { aiPayload: JSON.parse(JSON.stringify(reply)) }
                : {}),
              aiMessageId: reply?.message_id,
              conversationId: conversation.id,
            },
          });

          const balance = charge?.balanceAfter ?? {
            creditBalance: wallet.creditBalance,
            creditsUsed: activeSubscription.creditsUsed,
            creditAllowance: activeSubscription.creditAllowance,
          };

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
            message_type: reply?.message_type ?? 'text',
            media: reply?.media ?? null,
            transcript: reply?.transcript ?? null,
            mode: conversation.mode,
            message: savedMessage,
            response: reply?.response ?? null,
            conversationId: conversation.id,
            usage: {
              creditsUsed: balance.creditsUsed,
              creditAllowance: balance.creditAllowance,
              subscriptionCreditsRemaining: Math.max(
                balance.creditAllowance - balance.creditsUsed,
                0,
              ),
              purchasedCredits: balance.creditBalance,
              creditBalance: balance.creditBalance,
              chargedFrom: !charge
                ? 'included'
                : charge.fromSubscription > 0 && charge.fromPurchased > 0
                  ? 'subscription_and_purchased'
                  : usedCredit
                    ? 'purchased'
                    : 'subscription',
            },
          };
        },
        {
          maxWait: 5000,
          timeout: 2 * (this.aiApi.requestTimeoutMs || 60000) + 15000,
        },
      );
    } finally {
      if (process.env.AI_API_LOG_TIMING === 'true') {
        const ended = Date.now();
        this.logger.log(
          `type=${type}, lockWaitMs=${(lockedAt ?? ended) - started}, prepareMs=${lockedAt ? (aiStartedAt ?? ended) - lockedAt : 0}, aiMs=${aiStartedAt ? (aiFinishedAt ?? ended) - aiStartedAt : 0}, saveMs=${aiFinishedAt ? ended - aiFinishedAt : 0}, totalMs=${ended - started}`,
        );
      }
    }
  }
}
