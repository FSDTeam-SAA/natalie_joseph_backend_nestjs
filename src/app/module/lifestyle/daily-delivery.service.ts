import { HttpException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Interval } from '@nestjs/schedule';
import axios from 'axios';
import { PrismaService } from '../../../prisma/prisma.service';
import { LifestyleService } from './lifestyle.service';
import { botKeyForCompanion, botValue } from '../telegram/telegram-config';
import { localClock, policy } from './lifestyle-policy';

@Injectable()
export class DailyDeliveryService {
  private running = false;
  private readonly logger = new Logger(DailyDeliveryService.name);
  constructor(
    private readonly prisma: PrismaService,
    private readonly lifestyle: LifestyleService,
    private readonly config: ConfigService,
  ) {}
  @Interval(60000)
  async tick() {
    if (
      this.running ||
      this.config.get('DAILY_CONTENT_DELIVERY_ENABLED') !== 'true'
    )
      return;
    this.running = true;
    try {
      // Telegram has no idempotency key for sends: never automatically retry an uncertain send.
      await this.prisma.dailyDelivery.updateMany({
        where: {
          status: 'sending',
          updatedAt: { lt: new Date(Date.now() - 300000) },
        },
        data: {
          status: 'unknown',
          lastError:
            'Send outcome unknown; inspect Telegram before any manual action.',
        },
      });
      const now = new Date();
      const content = await this.prisma.dailyContent.findMany({
        where: {
          published: true,
          publishAt: { lte: now },
          expiresAt: { gt: now },
          companion: { status: true },
          photo: { approved: true },
        },
        orderBy: { publishAt: 'asc' },
        take: 20,
      });
      for (const item of content)
        for (const kind of ['photo', 'text']) {
          const preferences = await this.prisma.dailyPreference.findMany({
            where: {
              enabled: true,
              companionId: item.companionId,
              user: {
                status: 'approved',
                adultEligible: true,
                subscriptions: {
                  some: {
                    isActive: true,
                    startsAt: { lte: now },
                    endsAt: { gt: now },
                  },
                },
              },
              NOT: {
                user: {
                  dailyDeliveries: { some: { contentId: item.id, kind } },
                },
              },
            },
            orderBy: { userId: 'asc' },
            take: 50,
          });
          for (const preference of preferences)
            await this.deliver(preference.userId, item.id, kind);
        }
    } catch {
      this.logger.warn(
        'Daily content worker unavailable; check migration and configuration',
      );
    } finally {
      this.running = false;
    }
  }
  async deliver(userId: string, contentId: string, kind: string) {
    let deliveryId: string | undefined;
    try {
      const job = await this.prisma.$transaction(async (tx) => {
        await tx.$queryRaw`SELECT id FROM users WHERE id = ${userId} FOR UPDATE`;
        if (
          await tx.dailyDelivery.findUnique({
            where: { userId_contentId_kind: { userId, contentId, kind } },
          })
        )
          return null;
        const now = new Date();
        let content = await tx.dailyContent.findFirst({
          where: {
            id: contentId,
            published: true,
            publishAt: { lte: now },
            expiresAt: { gt: now },
            photo: { approved: true },
            companion: { status: true },
          },
          include: { photo: true },
        });
        if (!content) return null;
        // Serialize publication edits with delivery reservation.
        await tx.$queryRaw`SELECT id FROM companions WHERE id = ${content.companionId} FOR UPDATE`;
        content = await tx.dailyContent.findFirst({
          where: {
            id: contentId,
            published: true,
            publishAt: { lte: now },
            expiresAt: { gt: now },
            photo: { approved: true },
            companion: { status: true },
          },
          include: { photo: true },
        });
        if (!content) return null;
        const routine = await tx.companionRoutine.findUnique({
          where: { companionId: content.companionId },
        });
        if (
          localClock(routine?.timezone || 'Asia/Dubai', now).day !== content.day
        )
          return null;
        const preference = await tx.dailyPreference.findUnique({
          where: { userId },
        });
        if (
          !preference?.enabled ||
          preference.companionId !== content.companionId
        )
          return null;
        const subscription = await this.lifestyle.active(tx, userId),
          p = policy(subscription.entitlementPolicy);
        const link = await tx.telegramConnection.findUnique({
          where: {
            userId_companionId: { userId, companionId: content.companionId },
          },
        });
        const eligible =
          kind === 'photo'
            ? p.dailyPhoto || p.kind === 'trial'
            : p.dailyText && p.kind !== 'trial';
        if (!eligible) {
          await tx.dailyDelivery.create({
            data: {
              userId,
              contentId,
              kind,
              status: 'skipped',
              lastError: 'Not included in subscription',
            },
          });
          return null;
        }
        const token = link?.telegramId
          ? botValue(
              this.config,
              botKeyForCompanion(this.config, content.companionId),
              'BOT_TOKEN',
            )
          : null;
        try {
          await this.lifestyle.allowance(
            tx,
            subscription,
            kind === 'photo' ? 'included_photo' : 'included_text',
          );
        } catch (error) {
          if (
            !(error instanceof HttpException) ||
            ![402, 429].includes(error.getStatus())
          )
            throw error;
          await tx.dailyDelivery.create({
            data: {
              userId,
              contentId,
              kind,
              status: 'skipped',
              lastError: 'Included allowance already used or expired',
            },
          });
          return null;
        }
        const delivery = await tx.dailyDelivery.create({
          data: {
            userId,
            contentId,
            kind,
            status: token ? 'sending' : 'available',
          },
        });
        if (kind === 'photo')
          await tx.photoView.upsert({
            where: {
              userId_companionId_photoUrl: {
                userId,
                companionId: content.companionId,
                photoUrl: content.photo.url,
              },
            },
            create: {
              userId,
              companionId: content.companionId,
              photoUrl: content.photo.url,
              creditCost: 0,
            },
            update: { lastViewedAt: now },
          });
        await tx.notification.create({
          data: {
            userId,
            type: 'daily_content',
            title: 'Daily companion update',
            body:
              kind === 'text'
                ? content.text
                : content.photo.caption || 'Your daily photo',
            referenceId: delivery.id,
          },
        });
        return { delivery, content, chatId: link?.telegramId, token };
      });
      if (!job) return;
      if (!job.token) return;
      deliveryId = job.delivery.id;
      const body =
        kind === 'photo'
          ? {
              chat_id: job.chatId,
              photo: job.content.photo.url,
              caption: job.content.photo.caption,
            }
          : { chat_id: job.chatId, text: job.content.text };
      const response = await axios.post<{
        ok: boolean;
        result?: { message_id: number };
      }>(
        `https://api.telegram.org/bot${job.token}/${kind === 'photo' ? 'sendPhoto' : 'sendMessage'}`,
        body,
        { timeout: 20000, maxRedirects: 0 },
      );
      if (!response.data.ok) throw new Error('Telegram rejected daily content');
      await this.prisma.dailyDelivery.update({
        where: { id: deliveryId },
        data: {
          status: 'sent',
          telegramMessageId: response.data.result?.message_id,
        },
      });
    } catch (error) {
      if (deliveryId) {
        const rejected =
          axios.isAxiosError(error) &&
          !!error.response &&
          error.response.status >= 400 &&
          error.response.status < 500;
        await this.prisma.dailyDelivery.update({
          where: { id: deliveryId },
          data: {
            status: rejected ? 'failed' : 'unknown',
            lastError: rejected
              ? 'Telegram rejected delivery; inspect bot access and limits.'
              : 'Outcome uncertain. Automatic resend disabled to avoid duplicate messages.',
          },
        });
      }
      // Quota exhaustion/no access is expected; no provider credentials or content logged.
    }
  }
}
