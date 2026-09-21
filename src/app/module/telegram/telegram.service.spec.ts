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
