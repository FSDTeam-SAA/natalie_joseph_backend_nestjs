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
    const prisma = { $transaction: jest.fn(async (callback) => callback(tx)) };
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
