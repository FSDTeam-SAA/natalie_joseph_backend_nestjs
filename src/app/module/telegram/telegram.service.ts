import {
  ForbiddenException,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import { timingSafeEqual } from 'node:crypto';
import { TelegramAiService } from './telegram-ai.service';

@Injectable()
export class TelegramService {
  // Bounded, process-local retry protection; shared durable storage is needed for multiple replicas.
  private readonly completed = new Map<number, number>();
  private readonly pending = new Map<number, Promise<void>>();

  constructor(
    private readonly config: ConfigService,
    private readonly ai: TelegramAiService,
  ) {}

  verifySecret(secret?: string): void {
    const expected = this.config.get<string>('TELEGRAM_WEBHOOK_SECRET');
    if (!expected)
      throw new ServiceUnavailableException(
        'Telegram webhook is not configured',
      );
    const actualBuffer = Buffer.from(secret ?? '');
    const expectedBuffer = Buffer.from(expected);
    if (
      actualBuffer.length !== expectedBuffer.length ||
      !timingSafeEqual(actualBuffer, expectedBuffer)
    ) {
      throw new ForbiddenException('Invalid Telegram webhook secret');
    }
  }

  async receive(body: unknown): Promise<void> {
    if (!body || typeof body !== 'object') return;
    const update = body as {
      update_id?: number;
      message?: {
        text?: string;
        from?: { is_bot?: boolean };
        chat?: { id?: number; type?: string };
      };
    };
    const message = update.message;
    if (
      !Number.isSafeInteger(update.update_id) ||
      !message ||
      typeof message.text !== 'string' ||
      !Number.isSafeInteger(message.chat?.id) ||
      message.chat?.type !== 'private' ||
      message.from?.is_bot
    )
      return;
    if (
      this.config.get<string>('TELEGRAM_AUTO_REPLY_ENABLED', 'false') !== 'true'
    )
      return;
    const mode = this.config.get<string>('TELEGRAM_REPLY_MODE', 'ai');
    if (mode !== 'echo' && mode !== 'ai') {
      throw new ServiceUnavailableException(
        'TELEGRAM_REPLY_MODE must be echo or ai',
      );
    }
    const id = update.update_id!;
    const now = Date.now();
    for (const [key, expires] of this.completed)
      if (expires <= now) this.completed.delete(key);
    if (this.completed.has(id)) return;
    const existing = this.pending.get(id);
    if (existing) return existing;
    const work = this.reply(message.chat!.id!, message.text, id, mode);
    this.pending.set(id, work);
    try {
      await work;
      this.completed.set(id, now + 24 * 60 * 60 * 1000);
      if (this.completed.size > 10000)
        this.completed.delete(this.completed.keys().next().value!);
    } finally {
      this.pending.delete(id);
    }
  }

  private async reply(
    chatId: number,
    text: string,
    updateId: number,
    mode: string,
  ) {
    const stopTyping = mode === 'ai' ? this.startTyping(chatId) : () => {};
    try {
      const reply =
        mode === 'echo'
          ? `You said: ${text}`
          : await this.ai.reply(
              String(chatId),
              text,
              `telegram:elena:${chatId}:${updateId}`,
            );
      if (typeof reply === 'string' && reply)
        await this.sendMessage(chatId, reply);
      else if (reply && typeof reply === 'object') {
        await this.sendRequest('sendPhoto', {
          chat_id: chatId,
          photo: reply.media.url,
        });
      }
    } finally {
      stopTyping();
    }
  }

  private startTyping(chatId: number): () => void {
    const controller = new AbortController();
    let sending = false;
    const refresh = async () => {
      if (sending || controller.signal.aborted) return;
      sending = true;
      try {
        const token = this.config.get<string>('TELEGRAM_ELENA_BOT_TOKEN');
        if (!token) return;
        await axios.post(
          `https://api.telegram.org/bot${token}/sendChatAction`,
          { chat_id: chatId, action: 'typing' },
          { timeout: 3000, signal: controller.signal },
        );
      } catch {
        // A cosmetic status failure must not delay or prevent the AI reply.
      } finally {
        sending = false;
      }
    };
    void refresh();
    const timer = setInterval(() => void refresh(), 4000);
    timer.unref();
    return () => {
      clearInterval(timer);
      controller.abort();
    };
  }

  private async sendMessage(chatId: number, text: string): Promise<void> {
    await this.sendRequest('sendMessage', {
      chat_id: chatId,
      text: Array.from(text).slice(0, 4096).join(''),
    });
  }

  private async sendRequest(
    method: 'sendMessage' | 'sendPhoto',
    payload: { chat_id: number; text?: string; photo?: string },
  ): Promise<void> {
    const token = this.config.get<string>('TELEGRAM_ELENA_BOT_TOKEN');
    if (!token)
      throw new ServiceUnavailableException('Telegram bot is not configured');
    try {
      const response = await axios.post<{ ok: boolean }>(
        `https://api.telegram.org/bot${token}/${method}`,
        payload,
        { timeout: 10000 },
      );
      if (!response.data.ok) throw new Error('Telegram API rejected reply');
    } catch {
      // Never expose Axios errors: their request URLs contain the bot token.
      throw new ServiceUnavailableException(
        'Telegram reply failed; delivery may be retried',
      );
    }
  }
}
