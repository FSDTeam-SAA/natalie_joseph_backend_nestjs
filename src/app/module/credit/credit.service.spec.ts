import { ConflictException } from '@nestjs/common';
import { CreditService } from './credit.service';
import {
  closeSubscriptionCredits,
  grantSubscriptionCredits,
} from './credit-ledger';

function wallet() {
  const user = { id: 'u', creditBalance: 12, lowCreditNotified: false };
  const subscription = {
    id: 's',
    userId: 'u',
    creditAllowance: 10,
    creditsUsed: 8,
    messagesUsed: 2,
    endsAt: new Date(Date.now() + 86400000),
  };
  const lots = [
    { id: 'early', remainingAmount: 5 },
    { id: 'late', remainingAmount: 7 },
  ];
  const tx: any = {
    $queryRaw: jest.fn().mockResolvedValue([]),
    user: {
      findUniqueOrThrow: jest.fn(() => ({ ...user })),
      update: jest.fn(({ data }) => {
        if (data.creditBalance)
          user.creditBalance -= data.creditBalance.decrement;
        if (data.lowCreditNotified !== undefined)
          user.lowCreditNotified = data.lowCreditNotified;
        return user;
      }),
      updateMany: jest.fn(({ data }) => {
        user.creditBalance -= data.creditBalance.decrement;
        return { count: 1 };
      }),
    },
    userSubscription: {
      findMany: jest.fn().mockResolvedValue([]),
      findFirst: jest.fn(() => subscription),
      updateMany: jest.fn(({ data }) => {
        subscription.creditsUsed += data.creditsUsed.increment;
        return { count: 1 };
      }),
      update: jest.fn(({ data }) => {
        if (data.messagesUsed)
          subscription.messagesUsed += data.messagesUsed.increment;
        return subscription;
      }),
      count: jest.fn().mockResolvedValue(0),
      create: jest.fn(({ data }) => ({ id: 'new', ...data })),
    },
    purchasedCreditLot: {
      findMany: jest.fn(({ where }) => (where.expiresAt.lte ? [] : lots)),
      updateMany: jest.fn(({ where, data }) => {
        const lot = lots.find((l) => l.id === where.id);
        if (lot) lot.remainingAmount -= data.remainingAmount.decrement;
        return { count: 1 };
      }),
    },
    creditTransaction: { create: jest.fn().mockResolvedValue({}) },
    creditCost: { findMany: jest.fn().mockResolvedValue([]) },
    notification: { create: jest.fn().mockResolvedValue({}) },
  };
  return { tx, user, subscription, lots, service: new CreditService(tx) };
}

describe('Credit accounting', () => {
  it('splits a charge across allowance and earliest-expiring lots, recording both sources', async () => {
    const { tx, service, user, subscription, lots } = wallet();
    const result = await service.consumeCredits(tx, 'u', 8, {
      reason: 'voice',
      companionId: 'c',
      referenceId: 'm',
      message: true,
    });
    expect(result).toMatchObject({ fromSubscription: 2, fromPurchased: 6 });
    expect(user.creditBalance).toBe(6);
    expect(lots.map((lot) => lot.remainingAmount)).toEqual([0, 6]);
    expect(subscription.messagesUsed).toBe(3); // one message, not eight credits
    expect(
      tx.creditTransaction.create.mock.calls.map(([arg]) => arg.data),
    ).toEqual([
      expect.objectContaining({
        source: 'subscription',
        amount: 2,
        balanceBefore: 2,
        balanceAfter: 0,
        referenceId: 'm',
      }),
      expect.objectContaining({
        source: 'purchased',
        amount: 6,
        balanceBefore: 12,
        balanceAfter: 6,
        reason: 'voice',
      }),
    ]);
    expect(tx.notification.create).toHaveBeenCalledTimes(1);
  });
  it('rejects insufficient funds before changing lots or subscription usage', async () => {
    const { service, tx } = wallet();
    expect(await service.consumeCredits(tx, 'u', 15)).toBeNull();
    expect(tx.userSubscription.updateMany).not.toHaveBeenCalled();
    expect(tx.purchasedCreditLot.updateMany).not.toHaveBeenCalled();
  });
  it('cannot spend the balance again after a preceding charge', async () => {
    const { service, tx } = wallet();
    await service.consumeCredits(tx, 'u', 14);
    expect(await service.consumeCredits(tx, 'u', 1)).toBeNull();
  });
  it.each([-1, 1.5, NaN, Infinity])(
    'rejects invalid charge %s',
    async (amount) => {
      const { service, tx } = wallet();
      await expect(service.consumeCredits(tx, 'u', amount)).rejects.toThrow(
        'Invalid credit amount',
      );
    },
  );
  it('supports a zero-cost action while still counting one message', async () => {
    const { service, tx, subscription } = wallet();
    await service.consumeCredits(tx, 'u', 0, {
      reason: 'extra_message',
      message: true,
    });
    expect(subscription.messagesUsed).toBe(3);
    expect(tx.creditTransaction.create).not.toHaveBeenCalled();
  });
  it('throws on inconsistent lots so the caller transaction rolls back', async () => {
    const { service, tx } = wallet();
    tx.purchasedCreditLot.findMany.mockResolvedValue([]);
    await expect(service.consumeCredits(tx, 'u', 5)).rejects.toBeInstanceOf(
      ConflictException,
    );
  });
  it('records expiry once per lot, without changing subscription usage', async () => {
    const { service, tx, user, subscription } = wallet();
    tx.purchasedCreditLot.findMany
      .mockResolvedValueOnce([{ id: 'expired', remainingAmount: 5 }])
      .mockResolvedValue([]);
    expect(await service.expirePurchasedCredits(tx, 'u')).toBe(5);
    expect(await service.expirePurchasedCredits(tx, 'u')).toBe(0);
    expect(user.creditBalance).toBe(7);
    expect(subscription.creditsUsed).toBe(8);
    expect(tx.creditTransaction.create).toHaveBeenCalledTimes(1);
    expect(tx.creditTransaction.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        reason: 'expiry',
        referenceId: 'expired',
        balanceBefore: 12,
        balanceAfter: 7,
      }),
    });
  });
  it('notifies once while low, and re-arms after recovery', async () => {
    const { service, tx, user } = wallet();
    user.creditBalance = 1;
    await service.checkLowCredit(tx, 'u');
    await service.checkLowCredit(tx, 'u');
    expect(tx.notification.create).toHaveBeenCalledTimes(1);
    user.creditBalance = 20;
    await service.checkLowCredit(tx, 'u');
    user.creditBalance = 1;
    await service.checkLowCredit(tx, 'u');
    expect(tx.notification.create).toHaveBeenCalledTimes(2);
  });
  it('uses a configured threshold in detection', async () => {
    const { service, tx } = wallet();
    tx.creditCost.findMany.mockResolvedValue([
      { action: 'low_credit_threshold', credits: 20 },
    ]);
    expect(await service.checkLowCredit(tx, 'u')).toEqual({
      totalCredits: 14,
      threshold: 20,
      lowCredit: true,
    });
  });
  it('closes old allowance and grants a fresh allowance without changing purchased credits', async () => {
    const { tx, subscription, user } = wallet();
    tx.userSubscription.findMany.mockResolvedValue([subscription]);
    await grantSubscriptionCredits(tx, {
      userId: 'u',
      subscriptionId: 'vip',
      messageLimit: 100,
      creditAllowance: 100,
      endsAt: new Date(Date.now() + 86400000),
    });
    expect(user.creditBalance).toBe(12);
    expect(
      tx.creditTransaction.create.mock.calls.map(([arg]) => arg.data),
    ).toEqual([
      expect.objectContaining({
        source: 'subscription',
        reason: 'subscription_expiry',
        amount: 2,
      }),
      expect.objectContaining({
        source: 'subscription',
        reason: 'subscription_grant',
        amount: 100,
      }),
    ]);
  });
  it('does not expire already inactive subscriptions again', async () => {
    const { tx } = wallet();
    await closeSubscriptionCredits(tx, 'u', true);
    expect(tx.creditTransaction.create).not.toHaveBeenCalled();
  });
});
