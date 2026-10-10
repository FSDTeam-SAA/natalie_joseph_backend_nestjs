import {
  BotKey,
  botKeyForCompanion,
  botValue,
  websiteUrl,
  TelegramAction,
  miniAppUrl,
} from './telegram-config';
import {
  ForbiddenException,
  HttpException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { createHash, randomBytes } from 'crypto';
import { PrismaService } from '../../../prisma/prisma.service';
import { ChatService } from '../chat/chat.service';
import { MediaStoryService } from '../publishing/media-story.service';
import type { AiReply, AiAudio } from '../../helper/ai/aiapi';
import { AiVoiceFailure } from '../../helper/ai/ai-failure';

@Injectable()
export class TelegramAiService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly chat: ChatService,
    private readonly jwt: JwtService,
    private readonly stories: MediaStoryService,
    private readonly config: ConfigService,
  ) {}

  async status(userId: string, companionId: string) {
    const key = botKeyForCompanion(this.config, companionId);
    const [, companion, connection, subscription] = await Promise.all([
      this.getEligibleUser(userId),
      this.getCompanion(key),
      this.prisma.telegramConnection.findUnique({
        where: { userId_companionId: { userId, companionId } },
        select: { telegramId: true },
      }),
      this.hasSubscription(userId),
    ]);
    const active = Boolean(subscription);
    return {
      companionId,
      companionName: companion.name,
      linked: Boolean(connection?.telegramId),
      hasActiveSubscription: active,
      telegramUrl:
        connection?.telegramId && active
          ? `https://t.me/${botValue(this.config, key, 'BOT_USERNAME').replace(/^@/, '')}`
          : null,
      creditsUrl: websiteUrl(this.config, 'credits', companionId),
      subscriptionUrl: websiteUrl(this.config, 'subscription', companionId),
    };
  }

  async connect(userId: string, companionId: string) {
    const key = botKeyForCompanion(this.config, companionId);
    const username = botValue(this.config, key, 'BOT_USERNAME').replace(
      /^@/,
      '',
    );
    botValue(this.config, key, 'BOT_TOKEN');
    // Independent reads can overlap; never persist a link before all checks pass.
    const [, , subscription] = await Promise.all([
      this.getEligibleUser(userId),
      this.getCompanion(key),
      this.hasSubscription(userId),
    ]);
    if (!subscription) {
      throw new HttpException(
        'An active subscription is required. Subscribe on the website to connect Telegram.',
        402,
      );
    }
    const token = randomBytes(32).toString('hex');
    const linkExpiresAt = new Date(Date.now() + 10 * 60 * 1000);
    const data = { linkTokenHash: this.hash(token), linkExpiresAt };
    await this.prisma.telegramConnection.upsert({
      where: { userId_companionId: { userId, companionId } },
      create: { userId, companionId, ...data },
      update: data,
    });
    return {
      telegramUrl: `https://t.me/${username}?start=${token}`,
      expiresAt: linkExpiresAt,
    };
  }

  async reply(
    telegramId: string,
    text: string,
    messageKey: string,
    key: BotKey = 'ELENA',
    audio?: () => Promise<AiAudio>,
  ): Promise<
    | string
    | TelegramAction
    | {
        response: string;
        media: NonNullable<AiReply['media']>;
        audio?: AiAudio;
      }
    | null
  > {
    const companionId = botValue(this.config, key, 'COMPANION_ID');
    botKeyForCompanion(this.config, companionId);
    if (/^\/start(?:@\w+)?\s+/.test(text.trim())) {
      await this.getCompanion(key);
      return this.link(
        companionId,
        telegramId,
        text.trim().replace(/^\/start(?:@\w+)?\s+/, ''),
      );
    }
    const connection = await this.prisma.telegramConnection.findUnique({
      where: { telegramId_companionId: { telegramId, companionId } },
      select: { userId: true },
    });
    if (!connection || /^\/login(?:@\w+)?$/.test(text.trim()))
      return {
        text: 'Connect your Meet Elysia account to start chatting. Log in below, or choose Create Account in the login window.',
        buttons: [
          {
            text: 'Log In / Connect Account',
            web_app: { url: miniAppUrl(this.config, companionId) },
          },
        ],
      };
    if (/^\/start(?:@\w+)?$/.test(text.trim())) {
      const { name } = await this.getCompanion(key);
      if (this.stories.enabled())
        return {
          text: `Telegram is connected. Send a message to chat with ${name}, or view the latest stories.`,
          buttons: [
            {
              text: `View ${name}'s Stories`,
              web_app: { url: this.stories.viewerUrl(companionId) },
            },
          ],
        };
      return `Telegram is connected. Send a message to chat with ${name}.`;
    }
    if (/^\/stories(?:@\w+)?$/.test(text.trim())) {
      if (!this.stories.enabled()) return 'Stories are not available yet.';
      const { name } = await this.getCompanion(key);
      return {
        text: `See ${name}'s latest stories. Each story is available for 24 hours.`,
        buttons: [
          {
            text: `View ${name}'s Stories`,
            web_app: { url: this.stories.viewerUrl(companionId) },
          },
        ],
      };
    }

    try {
      const user = await this.getEligibleUser(connection.userId);
      // Mint a short-lived token for this linked user; never store a login JWT.
      const token = this.jwt.sign(
        {
          id: user.id,
          email: user.email,
          role: user.role,
          adultEligible: user.adultEligible,
          isSubscribed: user.isSubscribed,
        },
        {
          secret: this.config.getOrThrow<string>('ACCESS_TOKEN_SECRET'),
          expiresIn: '5m',
        },
      );
      const result = await this.chat.sendMessage(
        user.id,
        companionId,
        text,
        `Bearer ${token}`,
        audio ? 'voice' : 'text',
        messageKey,
        ...(audio ? [audio] : []),
      );
      if (
        result.media &&
        (result.message_type === 'image' || result.message_type === 'audio')
      ) {
        return {
          response: result.response || '',
          media: result.media,
          ...(result.media.kind === 'audio'
            ? {
                audio: await this.chat.getAudio(
                  result.media,
                  `Bearer ${token}`,
                ),
              }
            : {}),
        };
      }
      return result.response;
    } catch (error) {
      // The upstream has persisted this failed attempt and explicitly rejects
      // retries with the same key. Acknowledge it instead of blocking the bot queue.
      if (error instanceof AiVoiceFailure) return error.message;
      if (
        error instanceof HttpException &&
        [400, 402, 403, 404].includes(error.getStatus())
      ) {
        if (error.getStatus() === 402) {
          const active = await this.hasSubscription(connection.userId);
          return {
            text: active
              ? 'Your credits have run out. Buy credits to continue chatting.'
              : 'An active subscription is required. Subscribe or renew to continue chatting.',
            buttons: [
              {
                text: active ? 'Buy Credits' : 'Subscribe / Renew',
                url: websiteUrl(
                  this.config,
                  active ? 'credits' : 'subscription',
                  companionId,
                ),
              },
            ],
          };
        }
        return error.message;
      }
      throw error;
    }
  }

  private async hasSubscription(userId: string) {
    const now = new Date();
    return this.prisma.userSubscription.findFirst({
      where: {
        userId,
        isActive: true,
        startsAt: { lte: now },
        endsAt: { gt: now },
      },
      select: { id: true },
    });
  }

  private async getCompanion(key: BotKey) {
    const id = botValue(this.config, key, 'COMPANION_ID');
    botKeyForCompanion(this.config, id);
    const companion = await this.prisma.companions.findFirst({
      where: { id, status: true },
      select: { id: true, name: true },
    });
    if (!companion) throw new NotFoundException('Active companion not found');
    return companion;
  }

  private async link(companionId: string, telegramId: string, token: string) {
    if (!/^[a-f\d]{64}$/.test(token))
      return 'Invalid link. Please create a new Telegram link from the website.';
    try {
      // Consume the token atomically. It cannot link a second account on replay.
      const result = await this.prisma.telegramConnection.updateMany({
        where: {
          companionId,
          linkTokenHash: this.hash(token),
          linkExpiresAt: { gt: new Date() },
        },
        data: { telegramId, linkTokenHash: null, linkExpiresAt: null },
      });
      return result.count
        ? 'Telegram connected. Send a message to start chatting.'
        : 'Link expired or already used. Please create a new link from the website.';
    } catch (error) {
      if ((error as { code?: string }).code === 'P2002')
        return 'This Telegram account is already linked to another account.';
      throw error;
    }
  }

  private async getEligibleUser(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        role: true,
        status: true,
        adultEligible: true,
        isSubscribed: true,
      },
    });
    if (
      !user ||
      user.status !== 'approved' ||
      user.role !== 'user' ||
      user.adultEligible !== true
    ) {
      throw new ForbiddenException(
        'An approved adult user account is required to chat',
      );
    }
    return user;
  }

  private hash(token: string) {
    return createHash('sha256').update(token).digest('hex');
  }
}
