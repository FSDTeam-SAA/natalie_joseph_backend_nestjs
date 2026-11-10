import { GiftService } from './gift.service';
import { PrismaService } from '../../../prisma/prisma.service';
import { CreditService } from '../credit/credit.service';

describe('Customer gifts', () => {
  function setup() {
    const tx = {
      $queryRaw: jest.fn().mockResolvedValue([]),
      giftTransaction: {
        findUnique: jest.fn(),
        findMany: jest.fn().mockResolvedValue([]),
        count: jest.fn().mockResolvedValue(0),
        create: jest.fn().mockImplementation(({ data }) => data),
      },
      gift: {
        findFirst: jest
          .fn()
          .mockResolvedValue({ id: 'gift', creditCost: 10, name: 'Rose' }),
        count: jest.fn().mockResolvedValue(0),
        findMany: jest.fn().mockResolvedValue([]),
      },
      companions: {
        findFirst: jest.fn().mockResolvedValue({ id: 'companion' }),
      },
      userSubscription: {
        findFirst: jest.fn().mockResolvedValue({ id: 'plan' }),
      },
      user: {
        findUniqueOrThrow: jest.fn().mockResolvedValue({ creditBalance: 20 }),
      },
      chatMessage: {
        create: jest.fn().mockResolvedValue({ id: 'message' }),
        update: jest.fn(),
      },
      chatConversation: {
        upsert: jest.fn().mockResolvedValue({ id: 'conversation' }),
      },
      relationship: { upsert: jest.fn() },
    };
    const prisma = {
      ...tx,
      $transaction: jest.fn().mockImplementation((fn) => fn(tx)),
    };
    const credits = {
      consumeCredits: jest.fn().mockResolvedValue({ fromPurchased: 10 }),
    };
    return {
      tx,
      credits,
      service: new GiftService(
        prisma as unknown as PrismaService,
        credits as unknown as CreditService,
      ),
    };
  }
  it('filters inactive gifts out of the customer catalogue but allows admin management', async () => {
    const { service, tx } = setup();
    await service.getActiveGifts({}, {});
    expect(tx.gift.findMany).toHaveBeenLastCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ isActive: true }),
      }),
    );
    await service.getActiveGifts({}, {}, true);
    expect(tx.gift.findMany.mock.calls[1][0].where.isActive).toBeUndefined();
  });
  it('scopes history and totals to the authenticated owner', async () => {
    const { service, tx } = setup();
    await service.history('owner', 2);
    expect(tx.giftTransaction.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: 'owner' },
        skip: 20,
        take: 20,
      }),
    );
    expect(tx.giftTransaction.count).toHaveBeenCalledWith({
      where: { userId: 'owner' },
    });
  });
  it('does not charge a retried successful request again', async () => {
    const { service, tx, credits } = setup();
    tx.giftTransaction.findUnique.mockResolvedValue({
      id: 'request',
      userId: 'owner',
      companionId: 'companion',
      giftId: 'gift',
    });
    expect(
      await service.sendGift('owner', 'companion', 'gift', 'request'),
    ).toMatchObject({ alreadySent: true });
    expect(credits.consumeCredits).not.toHaveBeenCalled();
  });
  it('rejects reused identifiers for a different owner or gift', async () => {
    const { service, tx, credits } = setup();
    tx.giftTransaction.findUnique.mockResolvedValue({
      userId: 'other',
      companionId: 'companion',
      giftId: 'gift',
    });
    await expect(
      service.sendGift('owner', 'companion', 'gift', 'request'),
    ).rejects.toThrow('does not match');
    expect(credits.consumeCredits).not.toHaveBeenCalled();
  });
  it('requires membership before deducting credits', async () => {
    const { service, tx, credits } = setup();
    tx.userSubscription.findFirst.mockResolvedValue(null);
    await expect(
      service.sendGift('owner', 'companion', 'gift'),
    ).rejects.toThrow('active subscription');
    expect(credits.consumeCredits).not.toHaveBeenCalled();
  });
  it('rejects a changed quote before deducting credits', async () => {
    const { service, credits } = setup();
    await expect(
      service.sendGift('owner', 'companion', 'gift', 'request', 5),
    ).rejects.toThrow('price changed');
    expect(credits.consumeCredits).not.toHaveBeenCalled();
  });
  it('persists the quoted cost and request identifier for a new gift', async () => {
    const { service, tx, credits } = setup();
    await service.sendGift('owner', 'companion', 'gift', 'request');
    expect(credits.consumeCredits).toHaveBeenCalledWith(tx, 'owner', 10, {
      reason: 'gift',
      companionId: 'companion',
      referenceId: 'request',
    });
    expect(tx.giftTransaction.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        id: 'request',
        creditCost: 10,
        userId: 'owner',
      }),
    });
  });
});
