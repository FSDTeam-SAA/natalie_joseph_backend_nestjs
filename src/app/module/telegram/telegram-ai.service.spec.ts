import { ConfigService } from '@nestjs/config';
import { HttpException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../../../prisma/prisma.service';
import { ChatService } from '../chat/chat.service';
import { TelegramAiService } from './telegram-ai.service';
import { AiVoiceFailure } from '../../helper/ai/ai-failure';

describe('Telegram AI user routing', () => {
  const prisma = {
    telegramConnection: {
      findUnique: jest.fn(),
      updateMany: jest.fn(),
      upsert: jest.fn(),
    },
    user: { findUnique: jest.fn() },
    companions: { findFirst: jest.fn() },
    userSubscription: { findFirst: jest.fn() },
  };
  const chat = { sendMessage: jest.fn(), getAudio: jest.fn() };
  const service = new TelegramAiService(
    prisma as unknown as PrismaService,
    chat as unknown as ChatService,
    new JwtService(),
    new ConfigService({
      ACCESS_TOKEN_SECRET: 'test-secret',
      TELEGRAM_ELENA_BOT_USERNAME: 'TestBot',
      TELEGRAM_ELENA_BOT_TOKEN: 'test-token',
      TELEGRAM_ELENA_COMPANION_ID: 'companion-1',
      TELEGRAM_CHLOE_BOT_TOKEN: 'chloe-token',
      TELEGRAM_CHLOE_BOT_USERNAME: 'ChloeBot',
      TELEGRAM_CHLOE_COMPANION_ID: 'companion-2',
      TELEGRAM_CREDITS_URL: 'https://example.com/credits',
      TELEGRAM_SUBSCRIPTION_URL: 'https://example.com/plans',
      TELEGRAM_CONNECT_URL: 'https://example.com/companions',
    }),
  );
  beforeEach(() => {
    jest.resetAllMocks();
    prisma.companions.findFirst.mockResolvedValue({
      id: 'companion-1',
      name: 'Elena',
    });
    prisma.userSubscription.findFirst.mockResolvedValue({
      id: 'subscription-1',
    });
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

  it('returns a user-facing notice for terminal provider failures instead of retrying forever', async () => {
    chat.sendMessage.mockRejectedValue(
      new AiVoiceFailure('speech_to_text_failed'),
    );
    expect(await service.reply('123', '', 'key', 'ELENA', jest.fn())).toContain(
      'No chat credits were charged',
    );
    expect(chat.getAudio).not.toHaveBeenCalled();
  });

  it('routes voice through voice billing and returns audio media', async () => {
    const loadAudio = jest.fn();
    const media = {
      kind: 'audio',
      url: 'https://example.com/reply.mp3',
      mime_type: 'audio/mpeg',
    };
    chat.sendMessage.mockResolvedValue({
      response: 'Hello',
      message_type: 'audio',
      media,
    });
    expect(
      await service.reply('123', '', 'voice-key', 'ELENA', loadAudio),
    ).toEqual({ response: 'Hello', media });
    expect(chat.sendMessage).toHaveBeenCalledWith(
      'user-1',
      'companion-1',
      '',
      expect.any(String),
      'voice',
      'voice-key',
      loadAudio,
    );
  });

  it('does not fetch voice audio for an unlinked account', async () => {
    prisma.telegramConnection.findUnique.mockResolvedValue(null);
    const loadAudio = jest.fn();
    await service.reply('123', '', 'voice-key', 'ELENA', loadAudio);
    expect(loadAudio).not.toHaveBeenCalled();
    expect(chat.sendMessage).not.toHaveBeenCalled();
  });

  it('blocks account linking without an active subscription', async () => {
    prisma.userSubscription.findFirst.mockResolvedValue(null);
    await expect(
      service.connect('user-1', 'companion-1'),
    ).rejects.toMatchObject({ status: 402 });
    expect(prisma.telegramConnection.upsert).not.toHaveBeenCalled();
    expect(prisma.userSubscription.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          startsAt: { lte: expect.any(Date) },
          endsAt: { gt: expect.any(Date) },
        }),
      }),
    );
  });

  it('routes Chloe to her own companion and creates her own deep link', async () => {
    prisma.companions.findFirst.mockResolvedValue({
      id: 'companion-2',
      name: 'Chloé',
    });
    const link = await service.connect('user-1', 'companion-2');
    expect(link.telegramUrl).toMatch(/^https:\/\/t.me\/ChloeBot\?start=/);
    await service.reply('123', 'Hello', 'chloe-key', 'CHLOE');
    expect(prisma.telegramConnection.findUnique).toHaveBeenCalledWith({
      where: {
        telegramId_companionId: {
          telegramId: '123',
          companionId: 'companion-2',
        },
      },
    });
    expect(chat.sendMessage).toHaveBeenCalledWith(
      'user-1',
      'companion-2',
      'Hello',
      expect.any(String),
      'text',
      'chloe-key',
    );
  });

  it('returns a renewal button when subscription expires, then resumes after payment', async () => {
    prisma.userSubscription.findFirst.mockResolvedValue(null);
    chat.sendMessage.mockRejectedValueOnce(
      new HttpException('An active subscription is required', 402),
    );
    expect(await service.reply('123', 'Hello', 'k')).toMatchObject({
      buttons: [
        {
          text: 'Subscribe / Renew',
          url: expect.stringContaining('/plans?companionId=companion-1'),
        },
      ],
    });
    prisma.userSubscription.findFirst.mockResolvedValue({ id: 'renewed' });
    expect(await service.reply('123', 'Hello again', 'k2')).toBe(
      'Hello from AI',
    );
  });

  it('returns a bot URL only for an already linked, subscribed account', async () => {
    prisma.telegramConnection.findUnique.mockResolvedValue({
      telegramId: '123',
    });
    expect(await service.status('user-1', 'companion-1')).toMatchObject({
      linked: true,
      hasActiveSubscription: true,
      telegramUrl: 'https://t.me/TestBot',
    });
    prisma.userSubscription.findFirst.mockResolvedValue(null);
    expect(await service.status('user-1', 'companion-1')).toMatchObject({
      linked: true,
      hasActiveSubscription: false,
      telegramUrl: null,
    });
  });

  it('uses the updated companion name in the welcome message', async () => {
    prisma.companions.findFirst.mockResolvedValue({
      id: 'companion-1',
      name: 'Updated name',
    });
    expect(await service.reply('123', '/start', 'k')).toContain('Updated name');
  });

  it('rejects another companion and ineligible users', async () => {
    await expect(service.connect('user-1', 'other')).rejects.toThrow(
      'exactly one Telegram bot',
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
    expect(await service.reply('8801712345678', 'Hello', 'k')).toMatchObject({
      buttons: [
        {
          text: 'Connect account',
          url: expect.stringContaining('/companions?companionId=companion-1'),
        },
      ],
    });
    expect(chat.sendMessage).not.toHaveBeenCalled();
  });

  it('returns subscription/credit denials and respects human mode', async () => {
    chat.sendMessage.mockRejectedValueOnce(
      new HttpException('Not enough credits', 402),
    );
    expect(await service.reply('8801712345678', 'Hello', 'k')).toMatchObject({
      buttons: [
        {
          text: 'Buy Credits',
          url: expect.stringContaining('/credits?companionId=companion-1'),
        },
      ],
    });
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
