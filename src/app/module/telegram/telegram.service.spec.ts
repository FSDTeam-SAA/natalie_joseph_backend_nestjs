import { ConfigService } from '@nestjs/config';
import {
  ForbiddenException,
  ServiceUnavailableException,
} from '@nestjs/common';
import axios from 'axios';
import { TelegramAiService } from './telegram-ai.service';
import { TelegramService } from './telegram.service';
import { TelegramWebhookController } from './telegram-webhook.controller';

jest.mock('axios');
// eslint-disable-next-line @typescript-eslint/unbound-method -- Jest replaces Axios methods with mocks.
const post = axios.post as jest.Mock;

describe('Telegram echo webhook', () => {
  let service: TelegramService;
  const ai = { reply: jest.fn() };
  const createService = (config: ConfigService) =>
    new TelegramService(config, ai as unknown as TelegramAiService);
  const update = {
    update_id: 1,
    message: { text: 'hello', chat: { id: 123, type: 'private' } },
  };
  beforeEach(() => {
    jest.resetAllMocks();
    service = createService(
      new ConfigService({
        TELEGRAM_WEBHOOK_SECRET: 'test-secret',
        TELEGRAM_ELENA_BOT_TOKEN: 'test-token',
        TELEGRAM_AUTO_REPLY_ENABLED: 'true',
        TELEGRAM_REPLY_MODE: 'echo',
      }),
    );
    post.mockResolvedValue({ data: { ok: true } });
  });
  it('rejects missing or incorrect secrets before sending', async () => {
    const controller = new TelegramWebhookController(service);
    await expect(controller.receive(update)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    await expect(controller.receive(update, 'wrong')).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    expect(post).not.toHaveBeenCalled();
  });
  it('sends an echo and acknowledges an authenticated update', async () => {
    await expect(
      new TelegramWebhookController(service).receive(update, 'test-secret'),
    ).resolves.toEqual({ ok: true });
    expect(post).toHaveBeenCalledWith(
      expect.stringContaining('/sendMessage'),
      { chat_id: 123, text: 'You said: hello' },
      { timeout: 10000 },
    );
  });
  it('deduplicates concurrent deliveries and completed updates', async () => {
    await Promise.all([service.receive(update), service.receive(update)]);
    await service.receive(update);
    expect(post).toHaveBeenCalledTimes(1);
  });

  it('downloads an incoming voice with its own bot token and uploads the AI audio reply', async () => {
    service = createService(
      new ConfigService({
        TELEGRAM_CHLOE_BOT_TOKEN: 'chloe-token',
        TELEGRAM_AUTO_REPLY_ENABLED: 'true',
        TELEGRAM_REPLY_MODE: 'ai',
      }),
    );
    const get = jest
      .spyOn(axios, 'get')
      .mockResolvedValue({ data: new Uint8Array([1, 2, 3]).buffer });
    post.mockImplementation((url: string) =>
      Promise.resolve({
        data: url.endsWith('/getFile')
          ? { ok: true, result: { file_path: 'voice/file.oga', file_size: 3 } }
          : { ok: true },
      }),
    );
    ai.reply.mockImplementation(async (_chat, _text, _key, _bot, audio) => {
      const input = await audio();
      expect(input).toMatchObject({
        filename: 'file.oga',
        mimeType: 'audio/ogg',
      });
      expect(input.bytes.byteLength).toBe(3);
      return {
        response: 'Spoken reply',
        audio: {
          bytes: new Uint8Array([1, 2, 3]),
          mimeType: 'audio/mpeg',
          filename: 'reply.mp3',
        },
        media: {
          kind: 'audio',
          url: 'https://example.com/reply.mp3',
          mime_type: 'audio/mpeg',
        },
      };
    });
    const voiceUpdate = {
      update_id: 101,
      message: {
        voice: { file_id: 'file-1', mime_type: 'audio/ogg', file_size: 3 },
        chat: { id: 123, type: 'private' },
      },
    };
    await service.receive(voiceUpdate, 'CHLOE');
    await service.receive(voiceUpdate, 'CHLOE');
    expect(ai.reply).toHaveBeenCalledTimes(1);
    expect(post).toHaveBeenCalledWith(
      'https://api.telegram.org/botchloe-token/getFile',
      { file_id: 'file-1' },
      { timeout: 10000 },
    );
    expect(get).toHaveBeenCalledWith(
      'https://api.telegram.org/file/botchloe-token/voice/file.oga',
      expect.objectContaining({
        maxContentLength: 10 * 1024 * 1024,
        maxRedirects: 0,
      }),
    );
    const voice = post.mock.calls.find(([url]) => url.endsWith('/sendVoice'))!;
    expect(voice[0]).toBe('https://api.telegram.org/botchloe-token/sendVoice');
    const form = voice[1] as FormData;
    expect(form.get('chat_id')).toBe('123');
    expect((form.get('voice') as File).name).toBe('reply.mp3');
    expect(post.mock.calls.some(([url]) => url.endsWith('/sendPhoto'))).toBe(
      false,
    );
  });

  it('rejects oversized voice before AI and file download', async () => {
    service = createService(
      new ConfigService({
        TELEGRAM_ELENA_BOT_TOKEN: 'token',
        TELEGRAM_AUTO_REPLY_ENABLED: 'true',
        TELEGRAM_REPLY_MODE: 'ai',
      }),
    );
    await service.receive({
      update_id: 5,
      message: {
        voice: { file_id: 'huge', file_size: 21 * 1024 * 1024 },
        chat: { id: 123, type: 'private' },
      },
    });
    expect(ai.reply).not.toHaveBeenCalled();
    expect(post).toHaveBeenCalledTimes(1);
    expect(post.mock.calls[0][1].text).toContain('10 MB');
  });

  it('keeps identical update IDs separate across all five bot tokens', async () => {
    const keys = ['ELENA', 'CHLOE', 'LINA', 'LUNA', 'THALIA'] as const;
    const values = Object.fromEntries(
      keys.map((key) => [`TELEGRAM_${key}_BOT_TOKEN`, `${key}-token`]),
    );
    service = createService(
      new ConfigService({
        ...values,
        TELEGRAM_AUTO_REPLY_ENABLED: 'true',
        TELEGRAM_REPLY_MODE: 'echo',
      }),
    );
    for (const key of keys) {
      await service.receive(update, key);
      await service.receive(update, key);
      expect(post).toHaveBeenCalledWith(
        `https://api.telegram.org/bot${key}-token/sendMessage`,
        expect.any(Object),
        expect.any(Object),
      );
    }
    expect(post).toHaveBeenCalledTimes(5);
  });

  it('sends purchase buttons through the receiving bot', async () => {
    service = createService(
      new ConfigService({
        TELEGRAM_AUTO_REPLY_ENABLED: 'true',
        TELEGRAM_REPLY_MODE: 'ai',
        TELEGRAM_CHLOE_BOT_TOKEN: 'chloe-token',
      }),
    );
    ai.reply.mockResolvedValue({
      text: 'Buy credits',
      buttons: [{ text: 'Buy Credits', url: 'https://example.com/credits' }],
    });
    await service.receive(update, 'CHLOE');
    expect(post).toHaveBeenCalledWith(
      'https://api.telegram.org/botchloe-token/sendMessage',
      {
        chat_id: 123,
        text: 'Buy credits',
        reply_markup: {
          inline_keyboard: [
            [{ text: 'Buy Credits', url: 'https://example.com/credits' }],
          ],
        },
      },
      { timeout: 10000 },
    );
  });
  it('allows retry after failure without leaking the API token', async () => {
    post.mockRejectedValueOnce(new Error('secret-token-url'));
    await expect(service.receive(update)).rejects.toThrow(
      'Telegram reply failed; delivery may be retried',
    );
    await service.receive(update);
    expect(post).toHaveBeenCalledTimes(2);
  });
  it('ignores malformed, non-text and group updates', async () => {
    for (const body of [
      null,
      {},
      { update_id: 2, message: {} },
      {
        ...update,
        message: { ...update.message, chat: { id: 123, type: 'group' } },
      },
    ])
      await service.receive(body);
    expect(post).not.toHaveBeenCalled();
  });
  it('does not reply when disabled', async () => {
    service = createService(
      new ConfigService({ TELEGRAM_AUTO_REPLY_ENABLED: 'false' }),
    );
    await service.receive(update);
    expect(post).not.toHaveBeenCalled();
  });
  it('routes AI mode through the same linked-user chat flow', async () => {
    service = createService(
      new ConfigService({
        TELEGRAM_AUTO_REPLY_ENABLED: 'true',
        TELEGRAM_REPLY_MODE: 'ai',
        TELEGRAM_ELENA_BOT_TOKEN: 'test-token',
      }),
    );
    ai.reply.mockResolvedValue('Hello from Elena');
    await service.receive(update);
    expect(ai.reply).toHaveBeenCalledWith(
      '123',
      'hello',
      'telegram:elena:123:1',
      'ELENA',
    );
    expect(
      post.mock.calls.find(([url]) => url.endsWith('/sendMessage'))[1].text,
    ).toBe('Hello from Elena');
  });
  it('sends AI images as photos without a text message or caption', async () => {
    service = createService(
      new ConfigService({
        TELEGRAM_AUTO_REPLY_ENABLED: 'true',
        TELEGRAM_REPLY_MODE: 'ai',
        TELEGRAM_ELENA_BOT_TOKEN: 'test-token',
      }),
    );
    ai.reply.mockResolvedValue({
      response: 'Elena shared an AI-generated image.',
      media: { url: 'https://example.com/photo.jpg' },
    });
    await service.receive(update);
    expect(post).toHaveBeenCalledTimes(2);
    expect(post).toHaveBeenCalledWith(
      expect.stringContaining('/sendPhoto'),
      {
        chat_id: 123,
        photo: 'https://example.com/photo.jpg',
      },
      { timeout: 10000 },
    );
  });

  it.each([false, true])(
    'refreshes typing while AI waits and cleans up on failure=%s',
    async (fail) => {
      jest.useFakeTimers();
      try {
        service = createService(
          new ConfigService({
            TELEGRAM_AUTO_REPLY_ENABLED: 'true',
            TELEGRAM_REPLY_MODE: 'ai',
            TELEGRAM_ELENA_BOT_TOKEN: 'test-token',
          }),
        );
        let resolve!: (value: string) => void;
        let reject!: (error: Error) => void;
        ai.reply.mockReturnValue(
          new Promise<string>((res, rej) => {
            resolve = res;
            reject = rej;
          }),
        );
        post.mockRejectedValueOnce(new Error('typing unavailable'));
        const work = service.receive(update);
        expect(ai.reply).toHaveBeenCalledTimes(1);
        expect(post.mock.calls[0][1]).toEqual({
          chat_id: 123,
          action: 'typing',
        });
        await jest.advanceTimersByTimeAsync(8000);
        expect(post).toHaveBeenCalledTimes(3);
        if (fail) {
          const expectation = expect(work).rejects.toThrow('AI failed');
          reject(new Error('AI failed'));
          await expectation;
        } else {
          resolve('Hello');
          await work;
        }
        const count = post.mock.calls.length;
        await jest.advanceTimersByTimeAsync(8000);
        expect(post).toHaveBeenCalledTimes(count);
        expect(post.mock.calls[0][2].signal.aborted).toBe(true);
        expect(jest.getTimerCount()).toBe(0);
      } finally {
        jest.useRealTimers();
      }
    },
  );

  it('fails closed when webhook secret is missing', () => {
    expect(() =>
      createService(new ConfigService({})).verifySecret('anything'),
    ).toThrow(ServiceUnavailableException);
  });
});
