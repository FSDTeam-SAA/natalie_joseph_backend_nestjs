import { ConfigService } from '@nestjs/config';
import { HttpException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../../../prisma/prisma.service';
import { ChatService } from '../chat/chat.service';
import { TelegramAiService } from './telegram-ai.service';

describe('Telegram AI user routing', () => {
  const prisma = {
    telegramConnection: {
      findUnique: jest.fn(),
      updateMany: jest.fn(),
      upsert: jest.fn(),
    },
    user: { findUnique: jest.fn() },
    companions: { findMany: jest.fn() },
  };
  const chat = { sendMessage: jest.fn() };
  const service = new TelegramAiService(
    prisma as unknown as PrismaService,
    chat as unknown as ChatService,
    new JwtService(),
    new ConfigService({
      ACCESS_TOKEN_SECRET: 'test-secret',
      TELEGRAM_ELENA_BOT_USERNAME: 'TestBot',
    }),
  );
  beforeEach(() => {
    jest.resetAllMocks();
    prisma.companions.findMany.mockResolvedValue([{ id: 'companion-1' }]);
    prisma.telegramConnection.findUnique.mockResolvedValue({
      userId: 'user-1',
    });
    prisma.user.findUnique.mockResolvedValue({
      id: 'user-1',
      email: 'test@example.com',
      role: 'user',
      status: 'approved',
      adultEligible: true,
      isSubscribed: true,
    });
    chat.sendMessage.mockResolvedValue({ response: 'Hello from AI' });
  });

  it('creates a single-use deep link and stores only its hash', async () => {
    const result = await service.connect('user-1', 'companion-1');
    const token = new URL(result.telegramUrl).searchParams.get('start');
    expect(token).toMatch(/^[a-f0-9]{64}$/);
    expect(
      prisma.telegramConnection.upsert.mock.calls[0][0].create.linkTokenHash,
    ).not.toBe(token);
  });

  it('rejects another companion and ineligible users', async () => {
    await expect(service.connect('user-1', 'other')).rejects.toThrow(
      'Elena only',
    );
    prisma.user.findUnique.mockResolvedValue({
      status: 'approved',
      role: 'user',
      adultEligible: false,
    });
    expect(await service.reply('123', 'Hello', 'key')).toContain(
      'approved adult',
    );
    expect(chat.sendMessage).not.toHaveBeenCalled();
  });

  it('uses the linked user, companion and webhook idempotency key', async () => {
    expect(await service.reply('8801712345678', 'Hello', 'phone:message')).toBe(
      'Hello from AI',
    );
    expect(chat.sendMessage).toHaveBeenCalledWith(
      'user-1',
      'companion-1',
      'Hello',
      expect.stringMatching(/^Bearer /),
      'text',
      'phone:message',
    );
    const token = chat.sendMessage.mock.calls[0][3].slice(7);
    expect(new JwtService().verify(token, { secret: 'test-secret' }).id).toBe(
      'user-1',
    );
  });

  it('never calls AI for an unlinked phone', async () => {
    prisma.telegramConnection.findUnique.mockResolvedValue(null);
    expect(await service.reply('8801712345678', 'Hello', 'k')).toContain(
      'connect',
    );
    expect(chat.sendMessage).not.toHaveBeenCalled();
  });

  it('returns subscription/credit denials and respects human mode', async () => {
    chat.sendMessage.mockRejectedValueOnce(
      new HttpException('Not enough credits', 402),
    );
    expect(await service.reply('8801712345678', 'Hello', 'k')).toBe(
      'Not enough credits',
    );
    chat.sendMessage.mockResolvedValueOnce({ response: null });
    expect(await service.reply('8801712345678', 'Hello', 'k2')).toBeNull();
  });

  it('consumes only an unexpired token scoped to the receiving companion', async () => {
    prisma.telegramConnection.updateMany.mockResolvedValue({ count: 1 });
    expect(
      await service.reply('8801712345678', `/start ${'a'.repeat(64)}`, 'k'),
    ).toContain('connected');
    expect(prisma.telegramConnection.updateMany).toHaveBeenCalledWith({
      where: {
        companionId: 'companion-1',
        linkTokenHash: expect.any(String),
        linkExpiresAt: { gt: expect.any(Date) },
      },
      data: {
        telegramId: '8801712345678',
        linkTokenHash: null,
        linkExpiresAt: null,
      },
    });
    expect(chat.sendMessage).not.toHaveBeenCalled();
    prisma.telegramConnection.updateMany.mockResolvedValue({ count: 0 });
    expect(
      await service.reply('8801712345678', `/start ${'a'.repeat(64)}`, 'k'),
    ).toContain('expired');
  });
});
