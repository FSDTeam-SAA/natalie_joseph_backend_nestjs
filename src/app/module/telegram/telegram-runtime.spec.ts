import axios from 'axios';
import { ConfigService } from '@nestjs/config';
import { telegramPost } from './telegram-http';
import { TelegramQueueService } from './telegram-queue.service';
import { TelegramService } from './telegram.service';
import { PrismaService } from '../../../prisma/prisma.service';
import { deploymentSettings } from '../../config/deployment';
import { RequestLimitGuard } from '../../middlewares/request-limit.guard';
import { ExecutionContext } from '@nestjs/common';

describe('Telegram retry and durable ingress', () => {
  afterEach(() => jest.restoreAllMocks());
  it('waits retry_after only on explicit 429 rejection', async () => {
    const post = jest
      .spyOn(axios, 'post')
      .mockRejectedValueOnce({
        isAxiosError: true,
        response: { status: 429, data: { parameters: { retry_after: 2 } } },
      })
      .mockResolvedValueOnce({ data: { ok: true } });
    const wait = jest.fn().mockResolvedValue(undefined);
    await telegramPost('https://example.test', {}, {}, wait);
    expect(wait).toHaveBeenCalledWith(2000);
    expect(post).toHaveBeenCalledTimes(2);
  });
  it('does not retry ambiguous timeouts', async () => {
    const post = jest
      .spyOn(axios, 'post')
      .mockRejectedValue({ isAxiosError: true, code: 'ECONNABORTED' });
    const wait = jest.fn();
    await expect(
      telegramPost('https://example.test', {}, {}, wait),
    ).rejects.toBeDefined();
    expect(post).toHaveBeenCalledTimes(1);
    expect(wait).not.toHaveBeenCalled();
  });
  it('stores an update before acknowledgement and leaves processing to the worker', async () => {
    const prisma = { $executeRaw: jest.fn().mockResolvedValue(1) };
    const telegram = { receive: jest.fn() };
    const queue = new TelegramQueueService(
      prisma as unknown as PrismaService,
      telegram as unknown as TelegramService,
      new ConfigService({
        TELEGRAM_QUEUE_ENABLED: 'true',
        TELEGRAM_AUTO_REPLY_ENABLED: 'true',
      }),
    );
    const update = {
      update_id: 1,
      message: { text: 'hello', chat: { id: 123, type: 'private' } },
    };
    await queue.receive(update);
    expect(prisma.$executeRaw).toHaveBeenCalled();
    expect(telegram.receive).not.toHaveBeenCalled();
    prisma.$executeRaw.mockRejectedValue(new Error('database down'));
    await expect(queue.receive(update)).rejects.toThrow('database down');
  });
  it('never queues unsupported/group updates', async () => {
    const prisma = { $executeRaw: jest.fn() };
    const queue = new TelegramQueueService(
      prisma as unknown as PrismaService,
      {} as TelegramService,
      new ConfigService({
        TELEGRAM_QUEUE_ENABLED: 'true',
        TELEGRAM_AUTO_REPLY_ENABLED: 'true',
      }),
    );
    await queue.receive({
      update_id: 1,
      message: { text: 'hello', chat: { id: 123, type: 'group' } },
    });
    await queue.receive(null);
    expect(prisma.$executeRaw).not.toHaveBeenCalled();
  });
  it('rate-limits canonical login paths using shared database counters', async () => {
    const prisma = { $queryRaw: jest.fn().mockResolvedValue([{ count: 31 }]) };
    const guard = new RequestLimitGuard(prisma as unknown as PrismaService);
    const ctx = {
      switchToHttp: () => ({
        getRequest: () => ({
          method: 'POST',
          path: '/api/v1/AUTH/LOGIN/',
          ip: '127.0.0.1',
          body: { email: 'test@example.com' },
        }),
      }),
    } as unknown as ExecutionContext;
    await expect(guard.canActivate(ctx)).rejects.toThrow('Too many');
  });
  it('requires safe production origins/secrets and encrypted AI transport', () => {
    expect(() => deploymentSettings({ NODE_ENV: 'production' })).toThrow(
      'CORS',
    );
    const env = {
      NODE_ENV: 'production',
      CORS_ORIGINS: 'https://example.com',
      ACCESS_TOKEN_SECRET: 'a'.repeat(32),
      REFRESH_TOKEN_SECRET: 'b'.repeat(32),
      AI_API_BASE_URL: 'https://ai.example.com',
    };
    expect(deploymentSettings(env).swagger).toBe(false);
    expect(() =>
      deploymentSettings({ ...env, AI_API_BASE_URL: 'http://ai.example.com' }),
    ).toThrow('HTTPS');
    expect(() =>
      deploymentSettings({ ...env, TELEGRAM_AUTO_REPLY_ENABLED: 'true' }),
    ).toThrow('QUEUE');
  });
});
