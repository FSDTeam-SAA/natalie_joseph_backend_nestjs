import { ConfigService } from '@nestjs/config';
import { HttpException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../../../prisma/prisma.service';
import { ChatService } from '../chat/chat.service';
import { WhatsAppAiService } from './whatsapp-ai.service';

describe('WhatsApp AI user routing', () => {
  const prisma = {
    whatsAppConnection: {
      findUnique: jest.fn(),
      updateMany: jest.fn(),
      upsert: jest.fn(),
    },
    user: { findUnique: jest.fn() },
    companions: { findFirst: jest.fn() },
  };
  const chat = { sendMessage: jest.fn() };
  const service = new WhatsAppAiService(
    prisma as unknown as PrismaService,
    chat as unknown as ChatService,
    new JwtService(),
    new ConfigService({ ACCESS_TOKEN_SECRET: 'test-secret' }),
  );
  beforeEach(() => {
    jest.resetAllMocks();
    prisma.whatsAppConnection.findUnique.mockResolvedValue({
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

  it('uses the linked user, companion and webhook idempotency key', async () => {
    expect(
      await service.reply(
        'companion-1',
        '8801712345678',
        'Hello',
        'phone:message',
      ),
    ).toBe('Hello from AI');
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
    prisma.whatsAppConnection.findUnique.mockResolvedValue(null);
    expect(await service.reply('c', '8801712345678', 'Hello', 'k')).toContain(
      'connect',
    );
    expect(chat.sendMessage).not.toHaveBeenCalled();
  });

  it('returns subscription/credit denials and respects human mode', async () => {
    chat.sendMessage.mockRejectedValueOnce(
      new HttpException('Not enough credits', 402),
    );
    expect(await service.reply('c', '8801712345678', 'Hello', 'k')).toBe(
      'Not enough credits',
    );
    chat.sendMessage.mockResolvedValueOnce({ response: null });
    expect(await service.reply('c', '8801712345678', 'Hello', 'k2')).toBeNull();
  });

  it('consumes only an unexpired token scoped to the receiving companion', async () => {
    prisma.whatsAppConnection.updateMany.mockResolvedValue({ count: 1 });
    expect(
      await service.reply('c', '8801712345678', `START ${'a'.repeat(64)}`, 'k'),
    ).toContain('connected');
    expect(prisma.whatsAppConnection.updateMany).toHaveBeenCalledWith({
      where: {
        companionId: 'c',
        linkTokenHash: expect.any(String),
        linkExpiresAt: { gt: expect.any(Date) },
      },
      data: { waId: '8801712345678', linkTokenHash: null, linkExpiresAt: null },
    });
    expect(chat.sendMessage).not.toHaveBeenCalled();
    prisma.whatsAppConnection.updateMany.mockResolvedValue({ count: 0 });
    expect(
      await service.reply('c', '8801712345678', `START ${'a'.repeat(64)}`, 'k'),
    ).toContain('expired');
  });
});
