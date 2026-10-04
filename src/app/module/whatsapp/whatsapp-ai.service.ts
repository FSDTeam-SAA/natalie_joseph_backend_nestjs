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
export class WhatsAppAiService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly chat: ChatService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  async connect(userId: string, companionId: string) {
    const companion = await this.prisma.companions.findFirst({
      where: { id: companionId, status: true, whatsappEnabled: true },
    });
    if (!companion?.whatsappPhoneNumber || !companion.whatsappPhoneNumberId) {
      throw new NotFoundException('Active WhatsApp companion not found');
    }
    await this.getEligibleUser(userId);
    const token = randomBytes(32).toString('hex');
    const linkExpiresAt = new Date(Date.now() + 10 * 60 * 1000);
    const data = { linkTokenHash: this.hash(token), linkExpiresAt };
    await this.prisma.whatsAppConnection.upsert({
      where: { userId_companionId: { userId, companionId } },
      create: { userId, companionId, ...data },
      update: data,
    });
    return {
      whatsappUrl: `https://wa.me/${companion.whatsappPhoneNumber.replace(/^\+/, '')}?text=${encodeURIComponent(`START ${token}`)}`,
      expiresAt: linkExpiresAt,
    };
  }

  async reply(
    companionId: string,
    waId: string,
    text: string,
    messageKey: string,
  ): Promise<
    string | { response: string; media: NonNullable<AiReply['media']> } | null
  > {
    if (text.trim().startsWith('START ')) {
      return this.link(companionId, waId, text.trim().slice(6).trim());
    }
    const connection = await this.prisma.whatsAppConnection.findUnique({
      where: { waId_companionId: { waId, companionId } },
    });
    if (!connection)
      return 'Please sign in on the website and connect your WhatsApp account first.';

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

  private async link(companionId: string, waId: string, token: string) {
    if (!/^[a-f\d]{64}$/.test(token))
      return 'Invalid link. Please create a new WhatsApp link from the website.';
    try {
      // Consume the token atomically. It cannot link a second phone on replay.
      const result = await this.prisma.whatsAppConnection.updateMany({
        where: {
          companionId,
          linkTokenHash: this.hash(token),
          linkExpiresAt: { gt: new Date() },
        },
        data: { waId, linkTokenHash: null, linkExpiresAt: null },
      });
      return result.count
        ? 'WhatsApp connected. Send a message to start chatting.'
        : 'Link expired or already used. Please create a new link from the website.';
    } catch (error) {
      if ((error as { code?: string }).code === 'P2002')
        return 'This WhatsApp number is already linked to another account.';
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
