import { ChatService } from './chat.service';
import { PrismaService } from '../../../prisma/prisma.service';
import { CreditService } from '../credit/credit.service';
import { AiApi } from '../../helper/ai/aiapi';

describe('WhatsApp chat retries', () => {
  it('reuses a committed response without another AI call or charge', async () => {
    const saved = {
      userId: 'u',
      companionId: 'c',
      response: 'Saved AI reply',
      conversationId: 'conversation',
      aiPayload: {
        message_type: 'image',
        media: { url: 'https://example.com/image.jpg', kind: 'image' },
      },
    };
    const tx = {
      $queryRaw: jest.fn(),
      chatMessage: { findUnique: jest.fn().mockResolvedValue(saved) },
    };
    const prisma = { $transaction: jest.fn((callback) => callback(tx)) };
    const credit = { consumeCredits: jest.fn() };
    const ai = { sendMessage: jest.fn() };
    const service = new ChatService(
      prisma as unknown as PrismaService,
      credit as unknown as CreditService,
      ai as unknown as AiApi,
    );
    expect(
      await service.sendMessage(
        'u',
        'c',
        'Hello',
        'Bearer test',
        'text',
        'phone:message',
      ),
    ).toMatchObject({
      response: 'Saved AI reply',
      message_type: 'image',
      media: saved.aiPayload.media,
    });
    expect(credit.consumeCredits).not.toHaveBeenCalled();
    expect(ai.sendMessage).not.toHaveBeenCalled();
  });
});

describe('Chat entitlement gates shared by Telegram', () => {
  it('charges the voice rate, uploads audio and stores the transcript', async () => {
    const tx = {
      $queryRaw: jest.fn(),
      chatMessage: {
        findUnique: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({ id: 'saved' }),
      },
      companions: { findFirst: jest.fn().mockResolvedValue({ id: 'c' }) },
      userSubscription: {
        findFirst: jest.fn().mockResolvedValue({ id: 's' }),
        findUnique: jest
          .fn()
          .mockResolvedValue({ creditsUsed: 5, creditAllowance: 100 }),
      },
      chatConversation: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'local',
          aiConversationId: 'remote',
          mode: 'ai',
        }),
        update: jest.fn(),
      },
      user: { findUnique: jest.fn().mockResolvedValue({ creditBalance: 10 }) },
      relationship: { upsert: jest.fn() },
    };
    const prisma = { $transaction: jest.fn((callback) => callback(tx)) };
    const credit = {
      getCosts: jest.fn().mockResolvedValue({ message: 1, voice: 5 }),
      consumeCredits: jest
        .fn()
        .mockResolvedValue({ fromPurchased: 5, fromSubscription: 0 }),
    };
    const media = { kind: 'audio', url: 'https://example.com/reply.mp3' };
    const ai = {
      sendMessage: jest.fn().mockResolvedValue({
        message_id: 'ai-message',
        response: 'Hello',
        message_type: 'audio',
        transcript: 'How are you?',
        media,
      }),
    };
    const audio = {
      bytes: new Uint8Array([1]),
      mimeType: 'audio/ogg',
      filename: 'voice.ogg',
    };
    const load = jest.fn().mockResolvedValue(audio);
    const service = new ChatService(
      prisma as unknown as PrismaService,
      credit as unknown as CreditService,
      ai as unknown as AiApi,
    );
    const result = await service.sendMessage(
      'u',
      'c',
      '',
      'Bearer test',
      'voice',
      'voice-key',
      load,
    );
    expect(credit.consumeCredits).toHaveBeenCalledWith(
      tx,
      'u',
      5,
      expect.objectContaining({ reason: 'voice' }),
    );
    expect(ai.sendMessage).toHaveBeenCalledWith(
      'remote',
      'c',
      '',
      'Bearer test',
      'voice-key',
      audio,
    );
    expect(tx.chatMessage.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        type: 'voice',
        message: 'How are you?',
        creditCost: 5,
      }),
    });
    expect(result.media).toEqual(media);
    tx.chatMessage.findUnique.mockResolvedValue({
      userId: 'u',
      companionId: 'c',
      response: 'Hello',
      aiPayload: { message_type: 'audio', media },
    });
    await service.sendMessage(
      'u',
      'c',
      '',
      'Bearer test',
      'voice',
      'voice-key',
      load,
    );
    expect(load).toHaveBeenCalledTimes(1);
    expect(credit.consumeCredits).toHaveBeenCalledTimes(1);
    expect(ai.sendMessage).toHaveBeenCalledTimes(1);
  });
  it.each([false, true])(
    'does not call AI when subscription=%s and usable credits are absent',
    async (subscribed) => {
      const tx = {
        $queryRaw: jest.fn(),
        chatMessage: {
          findUnique: jest.fn().mockResolvedValue(null),
          create: jest.fn(),
        },
        companions: { findFirst: jest.fn().mockResolvedValue({ id: 'c' }) },
        userSubscription: {
          findFirst: jest
            .fn()
            .mockResolvedValue(subscribed ? { id: 's' } : null),
        },
      };
      const prisma = {
        $transaction: jest.fn((callback) => callback(tx)),
      };
      const credit = {
        getCosts: jest.fn().mockResolvedValue({ message: 1 }),
        consumeCredits: jest.fn().mockResolvedValue(null),
      };
      const ai = { sendMessage: jest.fn(), createConversation: jest.fn() };
      const service = new ChatService(
        prisma as unknown as PrismaService,
        credit as unknown as CreditService,
        ai as unknown as AiApi,
      );
      await expect(
        service.sendMessage(
          'u',
          'c',
          'Hello',
          'Bearer test',
          'text',
          'telegram:elena:1:1',
        ),
      ).rejects.toMatchObject({ status: 402 });
      expect(ai.sendMessage).not.toHaveBeenCalled();
      expect(ai.createConversation).not.toHaveBeenCalled();
      expect(tx.chatMessage.create).not.toHaveBeenCalled();
      if (!subscribed) expect(credit.consumeCredits).not.toHaveBeenCalled();
    },
  );
});
