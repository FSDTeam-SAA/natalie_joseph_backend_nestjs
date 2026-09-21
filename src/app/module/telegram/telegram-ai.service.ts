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
import type { AiReply } from '../../helper/ai/aiapi';

@Injectable()
export class TelegramAiService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly chat: ChatService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  async connect(userId: string, companionId: string) {
    const companion = await this.getCompanion();
    if (companion.id !== companionId)
      throw new NotFoundException('This bot is configured for Elena only');
    const username = this.config
      .getOrThrow<string>('TELEGRAM_ELENA_BOT_USERNAME')
      .replace(/^@/, '');
    await this.getEligibleUser(userId);
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
  ): Promise<
    string | { response: string; media: NonNullable<AiReply['media']> } | null
  > {
    const { id: companionId } = await this.getCompanion();
    if (/^\/start(?:@\w+)?\s+/.test(text.trim())) {
      return this.link(
        companionId,
        telegramId,
        text.trim().replace(/^\/start(?:@\w+)?\s+/, ''),
      );
    }
    const connection = await this.prisma.telegramConnection.findUnique({
      where: { telegramId_companionId: { telegramId, companionId } },
    });
    if (!connection)
      return 'Please sign in on the website and connect your Telegram account first.';
    if (/^\/start(?:@\w+)?$/.test(text.trim()))
      return 'Telegram is connected. Send a message to chat with Elena.';

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
        'text',
        messageKey,
      );
      if (result.media && result.message_type === 'image') {
        return { response: result.response || '', media: result.media };
      }
      return result.response;
    } catch (error) {
      if (
        error instanceof HttpException &&
        [400, 402, 403, 404].includes(error.getStatus())
      ) {
        return error.message;
      }
      throw error;
    }
  }

  private async getCompanion() {
    const id = this.config.get<string>('TELEGRAM_ELENA_COMPANION_ID');
    const companions = await this.prisma.companions.findMany({
      where: {
        status: true,
        ...(id
          ? { id }
          : { name: { equals: 'Elena', mode: 'insensitive' as const } }),
      },
      take: 2,
    });
    if (companions.length !== 1)
      throw new NotFoundException(
        'Set TELEGRAM_ELENA_COMPANION_ID to an active Elena companion',
      );
    return companions[0];
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
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
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
