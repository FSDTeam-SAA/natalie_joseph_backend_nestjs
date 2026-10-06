import { CreditService } from './credit.service';
import { PrismaService } from '../../../prisma/prisma.service';
import { Prisma } from '../../../../prisma/generated/prisma/client';

describe('Credit charge balance reuse', () => {
  function setup(allowance = 10, used = 0, purchased = 20, notified = false) {
    const tx = {
      $queryRaw: jest.fn().mockResolvedValue([]),
      userSubscription: {
        findMany: jest.fn().mockResolvedValue([]),
        findFirst: jest.fn().mockResolvedValue({
          id: 'sub',
          creditAllowance: allowance,
          creditsUsed: used,
        }),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        update: jest.fn().mockResolvedValue({}),
      },
      user: {
        findUniqueOrThrow: jest.fn().mockResolvedValue({
          creditBalance: purchased,
          lowCreditNotified: notified,
        }),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        update: jest.fn().mockResolvedValue({}),
      },
      purchasedCreditLot: {
        findMany: jest
          .fn()
          .mockImplementation((args) =>
            Promise.resolve(
              args.where.expiresAt.lte
                ? []
                : [{ id: 'lot', remainingAmount: purchased }],
            ),
          ),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      creditTransaction: { create: jest.fn().mockResolvedValue({}) },
      creditCost: { findMany: jest.fn().mockResolvedValue([]) },
      notification: { create: jest.fn().mockResolvedValue({}) },
    };
    const service = new CreditService(tx as unknown as PrismaService);
    const charge = (amount: number) =>
      service.consumeCredits(
        tx as unknown as Prisma.TransactionClient,
        'user',
        amount,
        { reason: 'voice', message: true, lowCreditThreshold: 10 },
      );
    return { tx, charge };
  }

  it('combines subscription debit and message count and avoids repeated balance reads', async () => {
    const { tx, charge } = setup();
    const result = await charge(3);
    expect(result?.balanceAfter).toEqual({
      creditBalance: 20,
      creditsUsed: 3,
      creditAllowance: 10,
    });
    expect(tx.userSubscription.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { creditsUsed: { increment: 3 }, messagesUsed: { increment: 1 } },
      }),
    );
    expect(tx.userSubscription.update).not.toHaveBeenCalled();
    expect(tx.$queryRaw).toHaveBeenCalledTimes(1);
    expect(tx.user.findUniqueOrThrow).toHaveBeenCalledTimes(1);
    expect(tx.userSubscription.findFirst).toHaveBeenCalledTimes(1);
    expect(tx.creditCost.findMany).not.toHaveBeenCalled();
  });

  it('calculates mixed-source balances and sends a low-credit notice once', async () => {
    const { tx, charge } = setup(10, 9, 5);
    const result = await charge(3);
    expect(result?.balanceAfter).toEqual({
      creditBalance: 3,
      creditsUsed: 10,
      creditAllowance: 10,
    });
    expect(tx.creditTransaction.create).toHaveBeenCalledTimes(2);
    expect(tx.notification.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          body: 'You have 3 credits remaining.',
        }),
      }),
    );
  });

  it('increments message count for purchased-only charges without repeating notifications', async () => {
    const { tx, charge } = setup(10, 10, 5, true);
    expect((await charge(3))?.balanceAfter.creditBalance).toBe(2);
    expect(tx.userSubscription.update).toHaveBeenCalledTimes(1);
    expect(tx.notification.create).not.toHaveBeenCalled();
  });

  it('does not debit an insufficient balance', async () => {
    const { tx, charge } = setup(10, 10, 1);
    expect(await charge(3)).toBeNull();
    expect(tx.creditTransaction.create).not.toHaveBeenCalled();
    expect(tx.user.updateMany).not.toHaveBeenCalled();
  });
});
