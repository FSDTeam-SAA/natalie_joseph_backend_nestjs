import { createHmac } from 'node:crypto';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../../prisma/prisma.service';
import { AuthService } from '../auth/auth.service';
import { ChatService } from '../chat/chat.service';
import {
  TelegramMiniAppService,
  verifyTelegramInitData,
} from './telegram-mini-app.service';
import { TelegramMiniAppController } from './telegram-mini-app.controller';
import type { Response } from 'express';

const token = '123:test-only';
function signed(
  age = 0,
  botToken = token,
  extras: Record<string, string> = {},
) {
  const params = new URLSearchParams({
    auth_date: String(Math.floor(Date.now() / 1000) - age),
    user: JSON.stringify({ id: 12345 }),
    ...extras,
  });
  const check = [...params.entries()]
    .sort(([a], [b]) => (a < b ? -1 : 1))
    .map(([k, v]) => `${k}=${v}`)
    .join('\n');
  const secret = createHmac('sha256', 'WebAppData').update(botToken).digest();
  params.set('hash', createHmac('sha256', secret).update(check).digest('hex'));
  return params.toString();
}

describe('Telegram signed identity', () => {
  it('accepts the signed user, including optional signed fields', () => {
    expect(
      verifyTelegramInitData(
        signed(0, token, { signature: 'extra', query_id: 'query' }),
        token,
      ),
    ).toBe('12345');
  });
  it.each([
    signed(601),
    signed(-90),
    signed(0, 'another-bot'),
    signed() + '&user=%7B%22id%22%3A999%7D',
    signed().replace('12345', '54321'),
  ])(
    'rejects expired, future, cross-bot, duplicate or tampered payload',
    (raw) => {
      expect(() => verifyTelegramInitData(raw, token)).toThrow();
    },
  );
});

describe('Mini App account linking', () => {
  const config = new ConfigService({
    TELEGRAM_ELENA_COMPANION_ID: 'companion',
    TELEGRAM_ELENA_BOT_TOKEN: token,
    TELEGRAM_ELENA_BOT_USERNAME: 'ExampleBot',
    TELEGRAM_PUBLIC_BASE_URL: 'https://api.example.com',
    TELEGRAM_CREDITS_URL: 'https://example.com/credits',
    TELEGRAM_SUBSCRIPTION_URL: 'https://example.com/plans',
  });
  function setup() {
    const connection = {
      findUnique: jest.fn().mockResolvedValue(null),
      upsert: jest.fn().mockResolvedValue({}),
    };
    const tx = {
      telegramConnection: connection,
      $queryRaw: jest.fn().mockResolvedValue([]),
    };
    const prisma = {
      companions: { findFirst: jest.fn().mockResolvedValue({ name: 'Elena' }) },
      user: {
        findUnique: jest.fn().mockResolvedValue({
          role: 'user',
          status: 'approved',
          adultEligible: true,
        }),
      },
      telegramConnection: {
        findUnique: jest.fn().mockResolvedValue({ userId: 'user' }),
      },
      $transaction: jest.fn(async (fn: (value: typeof tx) => Promise<void>) =>
        fn(tx),
      ),
    };
    const auth = {
      authenticate: jest.fn().mockResolvedValue({
        id: 'user',
        role: 'user',
        status: 'approved',
        adultEligible: true,
      }),
    };
    const chat = {
      getUsage: jest.fn().mockResolvedValue({
        subscription: { endsAt: new Date() },
        totalCredits: 200,
      }),
    };
    const service = new TelegramMiniAppService(
      config,
      prisma as unknown as PrismaService,
      auth as unknown as AuthService,
      chat as unknown as ChatService,
    );
    return { service, prisma, connection, auth, chat };
  }
  it('authenticates and links without returning passwords or JWTs', async () => {
    const { service, connection } = setup();
    const result = await service.login(
      'companion',
      signed(),
      'user@example.com',
      'password',
    );
    expect(connection.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: {
          userId: 'user',
          companionId: 'companion',
          telegramId: '12345',
        },
      }),
    );
    expect(result).toMatchObject({
      linked: true,
      state: 'ready',
      totalCredits: 200,
    });
    expect(result).not.toHaveProperty('accessToken');
    expect(result).not.toHaveProperty('user');
  });
  it('rejects invalid Telegram identity before checking credentials', async () => {
    const { service, auth } = setup();
    await expect(
      service.login(
        'companion',
        signed(0, 'wrong'),
        'user@example.com',
        'password',
      ),
    ).rejects.toThrow();
    expect(auth.authenticate).not.toHaveBeenCalled();
  });
  it('never binds a failed password or unapproved user', async () => {
    const { service, auth, connection } = setup();
    auth.authenticate.mockRejectedValueOnce(
      new Error('Invalid email or password'),
    );
    await expect(
      service.login('companion', signed(), 'user@example.com', 'bad'),
    ).rejects.toThrow();
    auth.authenticate.mockResolvedValueOnce({
      id: 'user',
      role: 'user',
      status: 'pending',
      adultEligible: true,
    });
    await expect(
      service.login('companion', signed(), 'user@example.com', 'password'),
    ).rejects.toThrow('approved');
    expect(connection.upsert).not.toHaveBeenCalled();
  });
  it('does not replace an existing Telegram binding', async () => {
    const { service, connection } = setup();
    connection.findUnique.mockResolvedValue({ telegramId: '999' });
    await expect(
      service.login('companion', signed(), 'user@example.com', 'password'),
    ).rejects.toThrow('another Telegram');
    expect(connection.upsert).not.toHaveBeenCalled();
  });
  it('handles the unique-index race without overwriting another account', async () => {
    const { service, connection } = setup();
    connection.upsert.mockRejectedValue({ code: 'P2002' });
    await expect(
      service.login('companion', signed(), 'user@example.com', 'password'),
    ).rejects.toThrow('different Meet Elysia');
  });
  it.each([
    [null, 200, 'subscription_required'],
    [{ endsAt: new Date() }, 0, 'credits_required'],
    [{ endsAt: new Date() }, 200, 'ready'],
  ])(
    'uses subscription and combined effective credits',
    async (subscription, totalCredits, state) => {
      const { service, chat } = setup();
      chat.getUsage.mockResolvedValue({ subscription, totalCredits });
      expect(await service.status('companion', signed())).toMatchObject({
        state,
      });
    },
  );
  it('limits repeated password guesses', async () => {
    const { service, auth } = setup();
    auth.authenticate.mockRejectedValue(new Error('Invalid email or password'));
    for (let i = 0; i < 10; i++)
      await service
        .login('companion', signed(), 'user@example.com', 'bad')
        .catch(() => {});
    await expect(
      service.login('companion', signed(), 'user@example.com', 'bad'),
    ).rejects.toThrow('Too many');
    expect(auth.authenticate).toHaveBeenCalledTimes(10);
  });
  it('returns a friendly unlinked state', async () => {
    const { service, prisma, chat } = setup();
    prisma.telegramConnection.findUnique.mockResolvedValue(null);
    expect(await service.status('companion', signed())).toEqual({
      linked: false,
    });
    expect(chat.getUsage).not.toHaveBeenCalled();
  });
  it('serves no-store HTML with matching script/style nonces', () => {
    const { service } = setup();
    const response = {
      set: jest.fn().mockReturnThis(),
      type: jest.fn().mockReturnThis(),
      send: jest.fn(),
    };
    new TelegramMiniAppController(service).page(
      response as unknown as Response,
    );
    const headers = response.set.mock.calls[0][0] as Record<string, string>;
    const nonce = headers['Content-Security-Policy'].match(/nonce-([^']+)/)![1];
    expect(headers['Cache-Control']).toBe('no-store');
    expect(response.send.mock.calls[0][0]).toContain(`nonce="${nonce}"`);
    expect(response.send.mock.calls[0][0]).not.toContain('__NONCE__');
  });
});
