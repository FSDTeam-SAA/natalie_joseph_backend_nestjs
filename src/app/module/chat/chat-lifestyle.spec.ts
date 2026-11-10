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
          .mockResolvedValue({ creditBalance: balance, adultEligible: true }),
      },
      chatConversation: {
        create: jest
          .fn()
          .mockImplementation(({ data }) =>
            Promise.resolve({ id: 'local', mode: 'ai', ...data }),
          ),
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
      createConversation: jest.fn().mockResolvedValue({ id: 'new-remote' }),
      sendMessage: jest.fn().mockResolvedValue({
        message_type: 'text',
        response: 'Hello',
        message_id: 'reply',
      }),
      requestTimeoutMs: 1000,
    };
    const lifestyle = {
      recentSharedPhotos: jest.fn().mockResolvedValue([]),
      matchPhoto: jest.fn().mockResolvedValue(null),
      recordPhotoView: jest.fn(),
      retainGeneratedPhoto: jest.fn(),
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
      message: 'Hello',
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
  const library = {
    id: 'photo',
    url: 'https://cdn.test/gym.jpg',
    mimeType: 'image/jpeg',
    caption: 'At the gym',
  };
  it('serves an approved match without an AI call and charges one photo', async () => {
    const { service, ai, credits, lifestyle } = setup();
    lifestyle.matchPhoto.mockResolvedValue(library as never);
    const result = await service.sendMessage(
      'u',
      'c',
      'Send me your gym photo',
      'Bearer test',
      'text',
      'key',
    );
    expect(result.message_type).toBe('image');
    expect(result.media?.url).toBe(library.url);
    expect(ai.sendMessage).not.toHaveBeenCalled();
    expect(credits.consumeCredits).toHaveBeenCalledWith(
      expect.anything(),
      'u',
      10,
      expect.objectContaining({ reason: 'photo' }),
    );
    expect(lifestyle.recordPhotoView).toHaveBeenCalledWith(
      expect.anything(),
      'u',
      'c',
      library.url,
      10,
    );
  });
  it('falls back to generation once, records the view and queues safe generic output for review', async () => {
    const { service, ai, lifestyle, credits } = setup();
    const reply = {
      message_id: 'reply',
      message_type: 'image',
      response: '',
      media: {
        id: 'generated',
        url: 'https://cdn.test/new.jpg',
        kind: 'image',
      },
    };
    ai.sendMessage.mockResolvedValue(reply as never);
    await service.sendMessage(
      'u',
      'c',
      '/photo gym',
      'Bearer test',
      'text',
      'key',
    );
    expect(ai.sendMessage).toHaveBeenCalledTimes(1);
    expect(ai.sendMessage.mock.calls[0][2]).toBe(
      'Send me a photo of yourself: gym',
    );
    expect(ai.sendMessage.mock.calls[0][6]).toMatchObject({
      access: { library_reuse: true },
    });
    expect(lifestyle.retainGeneratedPhoto).toHaveBeenCalledWith(
      expect.anything(),
      'c',
      reply,
      ['gym'],
    );
    expect(credits.consumeCredits).toHaveBeenCalledWith(
      expect.anything(),
      'u',
      10,
      expect.anything(),
    );
  });
  it('keeps custom personal generations out of the shared library', async () => {
    const { service, ai, lifestyle } = setup();
    ai.sendMessage.mockResolvedValue({
      message_id: 'reply',
      message_type: 'image',
      response: '',
      media: { url: 'https://cdn.test/private.jpg' },
    } as never);
    await service.sendMessage(
      'u',
      'c',
      'Send me a photo holding my passport',
      'Bearer test',
    );
    expect(lifestyle.retainGeneratedPhoto).not.toHaveBeenCalled();
  });
  it('uses included photo allowance on trial and never generates a missing trial image', async () => {
    const { service, ai, lifestyle, credits } = setup('trial', 'ai', 0);
    lifestyle.matchPhoto.mockResolvedValue(library as never);
    await service.sendMessage('u', 'c', '/photo gym', 'Bearer test');
    expect(lifestyle.allowance).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      'included_photo',
    );
    expect(credits.consumeCredits).not.toHaveBeenCalled();
    expect(ai.sendMessage).not.toHaveBeenCalled();
    lifestyle.matchPhoto.mockResolvedValue(null);
    await expect(
      service.sendMessage('u', 'c', '/photo gym', 'Bearer test'),
    ).rejects.toMatchObject({ status: 403 });
    expect(ai.sendMessage).not.toHaveBeenCalled();
  });
  it('does not look up photos in human mode or generate when photo credits are insufficient', async () => {
    const human = setup('paid', 'human', 0);
    await human.service.sendMessage('u', 'c', '/photo gym', 'Bearer test');
    expect(human.lifestyle.matchPhoto).not.toHaveBeenCalled();
    const paid = setup('paid', 'ai', 5);
    await expect(
      paid.service.sendMessage('u', 'c', '/photo gym', 'Bearer test'),
    ).rejects.toMatchObject({ status: 402 });
    expect(paid.ai.sendMessage).not.toHaveBeenCalled();
  });
  it('rejects a request ID reused with a different message', async () => {
    const { service, tx, ai } = setup();
    tx.chatMessage.findUnique.mockResolvedValue({
      userId: 'u',
      companionId: 'c',
      message: 'Hello',
    } as never);
    await expect(
      service.sendMessage(
        'u',
        'c',
        '/photo gym',
        'Bearer test',
        'text',
        'same-key',
      ),
    ).rejects.toMatchObject({ status: 400 });
    expect(ai.sendMessage).not.toHaveBeenCalled();
  });
  it('charges transcription as well as an image for a spoken image request', async () => {
    process.env.AI_RESPONSE_BILLING_ENABLED = 'true';
    const { service, ai, credits } = setup();
    ai.sendMessage.mockResolvedValue({
      message_type: 'image',
      message_id: 'r',
      response: '',
      billing: { transcription_seconds: 61 },
    } as never);
    await service.sendMessage(
      'u',
      'c',
      '[voice message]',
      'Bearer test',
      'voice',
      'audio-key',
      async () => ({
        bytes: new Uint8Array([1]),
        mimeType: 'audio/ogg',
        filename: 'input.ogg',
      }),
    );
    expect(credits.consumeCredits).toHaveBeenCalledWith(
      expect.anything(),
      'u',
      12,
      expect.anything(),
    );
  });
  it('enforces adult eligibility before photo lookup', async () => {
    const { service, tx, ai, lifestyle } = setup();
    tx.user.findUniqueOrThrow.mockResolvedValue({
      creditBalance: 100,
      adultEligible: false,
    });
    await expect(
      service.sendMessage('u', 'c', '/photo gym', 'Bearer test'),
    ).rejects.toMatchObject({ status: 403 });
    expect(lifestyle.matchPhoto).not.toHaveBeenCalled();
    expect(ai.sendMessage).not.toHaveBeenCalled();
  });
  it('can serve a first-turn library photo without creating an upstream conversation', async () => {
    const { service, tx, ai, lifestyle } = setup();
    tx.chatConversation.findUnique.mockResolvedValue(null as never);
    lifestyle.matchPhoto.mockResolvedValue(library as never);
    const result = await service.sendMessage(
      'u',
      'c',
      '/photo gym',
      'Bearer test',
    );
    expect(result.conversationId).toBe('local');
    expect(ai.createConversation).not.toHaveBeenCalled();
    expect(ai.sendMessage).not.toHaveBeenCalled();
  });
  it('does not generate or charge when library lookup itself fails', async () => {
    const { service, ai, lifestyle, credits } = setup();
    lifestyle.matchPhoto.mockRejectedValue(new Error('database failure'));
    await expect(
      service.sendMessage('u', 'c', '/photo gym', 'Bearer test'),
    ).rejects.toThrow('database failure');
    expect(ai.sendMessage).not.toHaveBeenCalled();
    expect(credits.consumeCredits).not.toHaveBeenCalled();
  });
  it('replays a saved library image without lookup, generation or another debit', async () => {
    const { service, tx, ai, lifestyle, credits } = setup();
    tx.chatMessage.findUnique.mockResolvedValue({
      userId: 'u',
      companionId: 'c',
      message: '/photo gym',
      response: 'saved',
      aiPayload: { message_type: 'image', media: { url: library.url } },
    } as never);
    const result = await service.sendMessage(
      'u',
      'c',
      '/photo gym',
      'Bearer test',
      'text',
      'same-photo',
    );
    expect(result.media?.url).toBe(library.url);
    expect(lifestyle.matchPhoto).not.toHaveBeenCalled();
    expect(ai.sendMessage).not.toHaveBeenCalled();
    expect(credits.consumeCredits).not.toHaveBeenCalled();
  });
  it('passes only this user companion delivery context to the next AI turn', async () => {
    const { service, ai, lifestyle } = setup();
    lifestyle.recentSharedPhotos.mockResolvedValue([
      { caption: 'At the gym', tags: ['gym'] },
    ] as never);
    await service.sendMessage(
      'u',
      'c',
      'Which photo did you send?',
      'Bearer test',
    );
    expect(lifestyle.recentSharedPhotos).toHaveBeenCalledWith(
      expect.anything(),
      'u',
      'c',
    );
    expect(ai.sendMessage.mock.calls[0][6]).toMatchObject({
      recentSharedPhotos: [{ caption: 'At the gym', tags: ['gym'] }],
    });
  });
  it('charges the voice rate for an actual audio reply in legacy billing mode', async () => {
    const { service, ai, credits } = setup();
    ai.sendMessage.mockResolvedValue({
      message_type: 'audio',
      message_id: 'r',
      response: 'Hello',
    } as never);
    await service.sendMessage('u', 'c', 'Send me a voice note', 'Bearer test');
    expect(credits.consumeCredits).toHaveBeenCalledWith(
      expect.anything(),
      'u',
      5,
      expect.objectContaining({ reason: 'voice' }),
    );
  });
});
