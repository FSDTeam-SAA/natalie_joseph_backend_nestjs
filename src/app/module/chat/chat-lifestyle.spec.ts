import { ChatService } from './chat.service';
import { PrismaService } from '../../../prisma/prisma.service';
import { CreditService } from '../credit/credit.service';
import { LifestyleService } from '../lifestyle/lifestyle.service';
import { AiApi } from '../../helper/ai/aiapi';

describe('Chat entitlement and charge boundaries', () => {
  const oldBilling = process.env.AI_RESPONSE_BILLING_ENABLED;
  const oldContext = process.env.AI_LIFESTYLE_CONTEXT_ENABLED;
  beforeEach(() => {
    process.env.AI_RESPONSE_BILLING_ENABLED = 'false';
    process.env.AI_LIFESTYLE_CONTEXT_ENABLED = 'false';
  });
  afterEach(() => {
    if (oldBilling === undefined)
      delete process.env.AI_RESPONSE_BILLING_ENABLED;
    else process.env.AI_RESPONSE_BILLING_ENABLED = oldBilling;
    if (oldContext === undefined)
      delete process.env.AI_LIFESTYLE_CONTEXT_ENABLED;
    else process.env.AI_LIFESTYLE_CONTEXT_ENABLED = oldContext;
  });
  function setup(kind = 'paid', mode = 'ai', balance = 100) {
    const tx = {
      $queryRaw: jest.fn(),
      companions: { findFirst: jest.fn().mockResolvedValue({ id: 'c' }) },
      userSubscription: {
        findFirst: jest.fn().mockResolvedValue({
          id: 's',
          startsAt: new Date(),
          creditAllowance: 0,
          creditsUsed: 0,
          entitlementPolicy: { kind },
        }),
      },
      user: {
        findUniqueOrThrow: jest
          .fn()
          .mockResolvedValue({ creditBalance: balance }),
      },
      chatConversation: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'conversation',
          aiConversationId: 'remote',
          mode,
        }),
        update: jest.fn(),
      },
      chatMessage: {
        findUnique: jest.fn().mockResolvedValue(null),
        create: jest
          .fn()
          .mockImplementation(({ data }) => Promise.resolve(data)),
      },
      relationship: { upsert: jest.fn() },
    };
    const credits = {
      getCosts: jest.fn().mockResolvedValue({
        message: 1,
        photo: 10,
        voice: 5,
        transcription: 1,
        low_credit_threshold: 10,
      }),
      expirePurchasedCredits: jest.fn(),
      consumeCredits: jest.fn().mockResolvedValue({
        fromSubscription: 0,
        fromPurchased: 10,
        balanceAfter: {
          creditBalance: 90,
          creditAllowance: 0,
          creditsUsed: 0,
        },
      }),
    };
    const ai = {
      sendMessage: jest.fn().mockResolvedValue({
        message_type: 'text',
        response: 'Hello',
        message_id: 'reply',
      }),
      requestTimeoutMs: 1000,
    };
    const lifestyle = {
      allowance: jest.fn(),
      context: jest
        .fn()
        .mockResolvedValue({ currentActivity: { activity: 'Gym' } }),
    };
    const prisma = {
      ...tx,
      $transaction: async (fn: (t: unknown) => unknown) => await fn(tx),
    };
    const service = new ChatService(
      prisma as unknown as PrismaService,
      credits as unknown as CreditService,
      ai as unknown as AiApi,
      lifestyle as unknown as LifestyleService,
    );
    return { service, tx, credits, ai, lifestyle };
  }
  it('charges an image response at the image rate when response billing is enabled', async () => {
    process.env.AI_RESPONSE_BILLING_ENABLED = 'true';
    const { service, credits, ai, lifestyle } = setup();
    ai.sendMessage.mockResolvedValue({
      message_type: 'image',
      response: 'Photo',
      message_id: 'reply',
    });
    await service.sendMessage(
      'u',
      'c',
      'Photo please',
      'Bearer test',
      'text',
      'request',
    );
    expect(credits.consumeCredits).toHaveBeenCalledWith(
      expect.anything(),
      'u',
      10,
      expect.objectContaining({ reason: 'photo' }),
    );
    expect(lifestyle.context).not.toHaveBeenCalled();
    expect(ai.sendMessage.mock.calls[0][6]).toMatchObject({
      access: { available_credits: 100, billing_mode: 'response' },
    });
  });
  it('does not debit credits when the upstream AI fails', async () => {
    const { service, credits, ai } = setup();
    ai.sendMessage.mockRejectedValue(new Error('AI unavailable'));
    await expect(
      service.sendMessage('u', 'c', 'Hello', 'Bearer test'),
    ).rejects.toThrow('unavailable');
    expect(credits.consumeCredits).not.toHaveBeenCalled();
  });
  it('stores a human-mode input without charging and accepts a zero balance', async () => {
    const { service, credits, ai } = setup('paid', 'human', 0);
    const result = await service.sendMessage('u', 'c', 'Hello', 'Bearer test');
    expect(result.message.creditCost).toBe(0);
    expect(ai.sendMessage).not.toHaveBeenCalled();
    expect(credits.consumeCredits).not.toHaveBeenCalled();
  });
  it('uses trial allowance without credit debit and blocks voice before AI', async () => {
    const { service, credits, ai, lifestyle } = setup('trial', 'ai', 0);
    await service.sendMessage('u', 'c', 'Hello', 'Bearer test');
    expect(lifestyle.allowance).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      'trial_reply',
    );
    expect(credits.consumeCredits).not.toHaveBeenCalled();
    ai.sendMessage.mockClear();
    await expect(
      service.sendMessage('u', 'c', 'Hi', 'Bearer test', 'voice'),
    ).rejects.toThrow('Voice is not included');
    expect(ai.sendMessage).not.toHaveBeenCalled();
  });
  it('returns a saved retry without AI or another debit', async () => {
    const { service, tx, credits, ai } = setup();
    tx.chatMessage.findUnique.mockResolvedValue({
      userId: 'u',
      companionId: 'c',
      response: 'Saved',
    } as never);
    expect(
      (
        await service.sendMessage(
          'u',
          'c',
          'Hello',
          'Bearer test',
          'text',
          'same-key',
        )
      ).response,
    ).toBe('Saved');
    expect(ai.sendMessage).not.toHaveBeenCalled();
    expect(credits.consumeCredits).not.toHaveBeenCalled();
  });
});
