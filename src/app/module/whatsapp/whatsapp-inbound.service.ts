import {
  ForbiddenException,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac, timingSafeEqual } from 'crypto';
import { WhatsAppService } from './whatsapp.service';
import { PrismaService } from '../../../prisma/prisma.service';
import { WhatsAppAiService } from './whatsapp-ai.service';

type Webhook = {
  object?: string;
  entry?: {
    changes?: {
      value?: {
        metadata?: { phone_number_id?: string };
        messages?: {
          id?: string;
          from?: string;
          type?: string;
          text?: { body?: string };
        }[];
      };
    }[];
  }[];
};

@Injectable()
export class WhatsAppInboundService {
  private readonly logger = new Logger(WhatsAppInboundService.name);
  // Test setup: deduplication is process-local and resets on restart.
  private readonly processed = new Map<string, number>();
  private readonly pending = new Map<string, Promise<void>>();

  constructor(
    private readonly config: ConfigService,
    private readonly whatsapp: WhatsAppService,
    private readonly prisma: PrismaService,
    private readonly ai: WhatsAppAiService,
  ) {}

  verifySignature(rawBody: Buffer | undefined, signature: string | undefined) {
    const secret = this.config.get<string>('WHATSAPP_APP_SECRET');
    if (!secret)
      throw new ServiceUnavailableException(
        'WhatsApp app secret is not configured',
      );
    if (!rawBody || !signature || !/^sha256=[a-f\d]{64}$/i.test(signature)) {
      throw new ForbiddenException('Invalid WhatsApp signature');
    }
    const expected = createHmac('sha256', secret).update(rawBody).digest();
    if (!timingSafeEqual(expected, Buffer.from(signature.slice(7), 'hex'))) {
      throw new ForbiddenException('Invalid WhatsApp signature');
    }
  }

  async receive(body: Webhook) {
    if (this.config.get<string>('WHATSAPP_AUTO_REPLY_ENABLED') !== 'true') {
      this.logger.warn('WhatsApp auto reply is disabled');
      return;
    }
    if (
      body?.object !== 'whatsapp_business_account' ||
      !Array.isArray(body.entry)
    )
      return;
    const now = Date.now();
    for (const [id, expires] of this.processed)
      if (expires <= now) this.processed.delete(id);
    for (const entry of body.entry) {
      if (!Array.isArray(entry?.changes)) continue;
      for (const change of entry.changes) {
        const value = change?.value;
        const phoneNumberId = value?.metadata?.phone_number_id;
        if (!phoneNumberId || !Array.isArray(value?.messages)) continue;

        // 1. The receiving Meta phone ID tells us which companion was contacted.
        const companion = await this.prisma.companions.findFirst({
          where: {
            whatsappPhoneNumberId: phoneNumberId,
            whatsappEnabled: true,
            status: true,
          },
          select: { id: true },
        });
        if (!companion) {
          this.logger.warn(
            `No active WhatsApp companion for phone ID ${phoneNumberId}`,
          );
          continue;
        }

        // 2. Resolve the linked user and reply through the existing AI chat flow.
        for (const message of value.messages) {
          if (
            !message?.id ||
            !message.from ||
            !/^[1-9]\d{6,14}$/.test(message.from) ||
            message.type !== 'text' ||
            typeof message.text?.body !== 'string'
          )
            continue;
          await this.replyOnce(
            companion.id,
            phoneNumberId,
            message.id,
            message.from,
            message.text.body,
          );
        }
      }
    }
  }

  private async replyOnce(
    companionId: string,
    phoneNumberId: string,
    messageId: string,
    to: string,
    text: string,
  ) {
    const key = `${phoneNumberId}:${messageId}`;
    if (this.processed.has(key)) return;
    const existing = this.pending.get(key);
    if (existing) return existing;

    const sending = this.sendReply(companionId, phoneNumberId, to, text, key);
    this.pending.set(key, sending);
    try {
      await sending;
    } finally {
      this.pending.delete(key);
    }
  }

  private async sendReply(
    companionId: string,
    phoneNumberId: string,
    to: string,
    text: string,
    key: string,
  ) {
    const mode = this.config.get<string>('WHATSAPP_REPLY_MODE') || 'ai';
    if (mode !== 'echo' && mode !== 'ai') {
      throw new ServiceUnavailableException(
        'WHATSAPP_REPLY_MODE must be echo or ai',
      );
    }
    this.logger.log(
      `Processing WhatsApp text: companion=${companionId}, mode=${mode}`,
    );
    // Echo isolates webhook delivery from user linking, AI and credit checks.
    const reply =
      mode === 'echo'
        ? `You said: ${text}`
        : await this.ai.reply(companionId, to, text, key);
    // Human takeover returns no automatic reply.
    if (typeof reply === 'string' && reply)
      await this.whatsapp.sendText(phoneNumberId, to, reply.slice(0, 4096));
    else if (reply && typeof reply === 'object')
      await this.whatsapp.sendImage(
        phoneNumberId,
        to,
        reply.media.url,
        reply.response,
      );
    this.logger.log(
      reply
        ? 'WhatsApp reply accepted by Meta'
        : 'No automatic reply (human mode)',
    );
    // Remember successful replies only, so failed sends can be retried.
    if (this.processed.size >= 10000) {
      this.processed.delete(this.processed.keys().next().value!);
    }
    this.processed.set(key, Date.now() + 24 * 60 * 60 * 1000);
  }
}
