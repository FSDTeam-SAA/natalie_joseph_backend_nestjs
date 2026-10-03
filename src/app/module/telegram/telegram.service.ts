import type { AiAudio } from '../../helper/ai/aiapi';
import {
  BotKey,
  botKeyForCompanion,
  botValue,
  webhookSecret,
  TelegramAction,
} from './telegram-config';
import {
  ForbiddenException,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import { timingSafeEqual } from 'node:crypto';
import { TelegramAiService } from './telegram-ai.service';

type TelegramAudio = {
  file_id: string;
  file_size?: number;
  duration?: number;
  mime_type?: string;
};
const MAX_AUDIO_BYTES = 10 * 1024 * 1024;

@Injectable()
export class TelegramService {
  // Bounded, process-local retry protection; shared durable storage is needed for multiple replicas.
  private readonly completed = new Map<string, number>();
  private readonly pending = new Map<string, Promise<void>>();

  constructor(
    private readonly config: ConfigService,
    private readonly ai: TelegramAiService,
  ) {}

  botKey(companionId: string): BotKey {
    return botKeyForCompanion(this.config, companionId);
  }

  verifySecret(secret?: string, key?: BotKey): void {
    const expected = key
      ? webhookSecret(this.config, key)
      : this.config.get<string>('TELEGRAM_WEBHOOK_SECRET');
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

  async receive(body: unknown, key: BotKey = 'ELENA'): Promise<void> {
    if (!body || typeof body !== 'object') return;
    const update = body as {
      update_id?: number;
      message?: {
        text?: string;
        voice?: TelegramAudio;
        audio?: TelegramAudio;
        from?: { is_bot?: boolean };
        chat?: { id?: number; type?: string };
      };
    };
    const message = update.message;
    if (
      !Number.isSafeInteger(update.update_id) ||
      !message ||
      (typeof message.text !== 'string' &&
        typeof (message.voice || message.audio)?.file_id !== 'string') ||
      !Number.isSafeInteger(message.chat?.id) ||
      message.chat?.type !== 'private' ||
      message.from?.is_bot
    )
      return;
    if (
      this.config.get<string>('TELEGRAM_AUTO_REPLY_ENABLED', 'false') !== 'true'
    )
      return;
    // Fail before running AI or consuming credits if outgoing credentials are absent.
    botValue(this.config, key, 'BOT_TOKEN');
    const mode = this.config.get<string>('TELEGRAM_REPLY_MODE', 'ai');
    if (mode !== 'echo' && mode !== 'ai') {
      throw new ServiceUnavailableException(
        'TELEGRAM_REPLY_MODE must be echo or ai',
      );
    }
    const updateId = update.update_id!;
    const id = `${key}:${updateId}`;
    const now = Date.now();
    for (const [key, expires] of this.completed)
      if (expires <= now) this.completed.delete(key);
    if (this.completed.has(id)) return;
    const existing = this.pending.get(id);
    if (existing) return existing;
    const work = this.reply(
      message.chat!.id!,
      message.text || '',
      updateId,
      mode,
      key,
      message.voice || message.audio,
    );
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
    key: BotKey,
    audio?: TelegramAudio,
  ) {
    if (audio?.file_size && audio.file_size > MAX_AUDIO_BYTES) {
      await this.sendMessage(
        chatId,
        'Please send an audio file smaller than 10 MB.',
        key,
      );
      return;
    }
    if (audio?.duration && audio.duration > 300) {
      await this.sendMessage(
        chatId,
        'Please send a voice message shorter than 5 minutes.',
        key,
      );
      return;
    }
    const stopTyping =
      mode === 'ai'
        ? this.startTyping(chatId, key, audio ? 'record_voice' : 'typing')
        : () => {};
    try {
      const reply =
        mode === 'echo'
          ? audio
            ? 'Voice messages require AI reply mode.'
            : `You said: ${text}`
          : await this.ai.reply(
              String(chatId),
              text,
              `telegram:${key.toLowerCase()}:${chatId}:${updateId}`,
              key,
              ...(audio ? [() => this.downloadAudio(audio, key)] : []),
            );
      if (typeof reply === 'string' && reply)
        await this.sendMessage(chatId, reply, key);
      else if (reply && typeof reply === 'object' && 'buttons' in reply) {
        await this.sendMessage(chatId, reply.text, key, reply.buttons);
      } else if (
        reply &&
        typeof reply === 'object' &&
        reply.media.kind === 'audio'
      ) {
        await this.sendVoice(chatId, reply.audio, key);
      } else if (reply && typeof reply === 'object') {
        await this.sendRequest(
          'sendPhoto',
          {
            chat_id: chatId,
            photo: reply.media.url,
          },
          key,
        );
      }
    } finally {
      stopTyping();
    }
  }

  private async downloadAudio(
    audio: TelegramAudio,
    key: BotKey,
  ): Promise<AiAudio> {
    const token = botValue(this.config, key, 'BOT_TOKEN');
    try {
      const file = await axios.post<{
        ok: boolean;
        result?: { file_path?: string; file_size?: number };
      }>(
        `https://api.telegram.org/bot${token}/getFile`,
        { file_id: audio.file_id },
        { timeout: 10000 },
      );
      const path = file.data.result?.file_path;
      if (
        !file.data.ok ||
        !path ||
        !/^[a-zA-Z0-9_/.-]+$/.test(path) ||
        path.split('/').includes('..') ||
        (file.data.result?.file_size || 0) > MAX_AUDIO_BYTES
      )
        throw new Error();
      const response = await axios.get<ArrayBuffer>(
        `https://api.telegram.org/file/bot${token}/${path}`,
        {
          responseType: 'arraybuffer',
          timeout: 20000,
          maxContentLength: MAX_AUDIO_BYTES,
          maxRedirects: 0,
        },
      );
      const bytes = new Uint8Array(response.data);
      if (!bytes.byteLength || bytes.byteLength > MAX_AUDIO_BYTES)
        throw new Error();
      return {
        bytes,
        filename: path.split('/').pop() || 'voice.ogg',
        mimeType: audio.mime_type || 'audio/ogg',
      };
    } catch {
      throw new ServiceUnavailableException(
        'Telegram audio download failed. Please try again.',
      );
    }
  }

  private async sendVoice(
    chatId: number,
    audio: AiAudio | undefined,
    key: BotKey,
  ) {
    try {
      if (!audio?.bytes.byteLength) throw new Error();
      const form = new FormData();
      form.set('chat_id', String(chatId));
      form.set(
        'voice',
        new Blob([new Uint8Array(audio.bytes)], { type: audio.mimeType }),
        audio.filename,
      );
      const token = botValue(this.config, key, 'BOT_TOKEN');
      const sent = await axios.post<{ ok: boolean }>(
        `https://api.telegram.org/bot${token}/sendVoice`,
        form,
        { timeout: 20000 },
      );
      if (!sent.data.ok) throw new Error();
    } catch {
      throw new ServiceUnavailableException(
        'Telegram voice reply failed; delivery may be retried',
      );
    }
  }

  private startTyping(
    chatId: number,
    key: BotKey,
    action: 'typing' | 'record_voice',
  ): () => void {
    const controller = new AbortController();
    let sending = false;
    const refresh = async () => {
      if (sending || controller.signal.aborted) return;
      sending = true;
      try {
        const token = botValue(this.config, key, 'BOT_TOKEN');
        if (!token) return;
        await axios.post(
          `https://api.telegram.org/bot${token}/sendChatAction`,
          { chat_id: chatId, action },
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

  private async sendMessage(
    chatId: number,
    text: string,
    key: BotKey,
    buttons?: TelegramAction['buttons'],
  ): Promise<void> {
    await this.sendRequest(
      'sendMessage',
      {
        chat_id: chatId,
        text: Array.from(text).slice(0, 4096).join(''),
        ...(buttons
          ? {
              reply_markup: {
                inline_keyboard: buttons.map((button) => [button]),
              },
            }
          : {}),
      },
      key,
    );
  }

  private async sendRequest(
    method: 'sendMessage' | 'sendPhoto',
    payload: {
      chat_id: number;
      text?: string;
      photo?: string;
      reply_markup?: { inline_keyboard: TelegramAction['buttons'][] };
    },
    key: BotKey,
  ): Promise<void> {
    const token = botValue(this.config, key, 'BOT_TOKEN');
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
