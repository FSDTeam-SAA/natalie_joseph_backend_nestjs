import { CreditService } from './credit.service';
import { PrismaService } from '../../../prisma/prisma.service';

describe('Read-only wallet', () => {
  const prisma = {
    user: { findUnique: jest.fn() },
    creditCost: { findMany: jest.fn() },
    $transaction: jest.fn(),
    $queryRaw: jest.fn(),
  };
  const service = new CreditService(prisma as unknown as PrismaService);
  beforeEach(() => {
    jest.resetAllMocks();
    prisma.creditCost.findMany.mockResolvedValue([]);
  });
  it('excludes expired lots without changing transaction history or locking the wallet', async () => {
    const active = {
      id: 'active',
      remainingAmount: 20,
      expiresAt: new Date(Date.now() + 60000),
    };
    const expired = {
      id: 'expired',
      remainingAmount: 10,
      expiresAt: new Date(0),
    };
    const history = [{ id: 'payment', amount: 30 }];
    prisma.user.findUnique.mockResolvedValue({
      creditBalance: 30,
      creditTransactions: history,
      purchasedCreditLots: [expired, active],
      subscriptions: [{ creditAllowance: 100, creditsUsed: 80 }],
    });
    expect(await service.getWallet('user')).toEqual({
      creditBalance: 20,
      creditTransactions: history,
      purchasedCreditLots: [active],
      totalCredits: 40,
      lowCredit: false,
      threshold: 10,
    });
    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(prisma.$queryRaw).not.toHaveBeenCalled();
    expect(prisma.user.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({
        select: expect.objectContaining({
          creditTransactions: {
            orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
            take: 50,
          },
          subscriptions: expect.objectContaining({
            where: {
              isActive: true,
              startsAt: { lte: expect.any(Date) },
              endsAt: { gt: expect.any(Date) },
            },
          }),
        }),
      }),
    );
  });
  it('handles an empty wallet and expired subscription with the configured threshold', async () => {
    prisma.creditCost.findMany.mockResolvedValue([
      { action: 'low_credit_threshold', credits: 5 },
    ]);
    prisma.user.findUnique.mockResolvedValue({
      creditBalance: 0,
      creditTransactions: [],
      purchasedCreditLots: [],
      subscriptions: [],
    });
    expect(await service.getWallet('user')).toMatchObject({
      creditBalance: 0,
      totalCredits: 0,
      lowCredit: true,
      threshold: 5,
    });
  });
  it('rejects a missing user', async () => {
    prisma.user.findUnique.mockResolvedValue(null);
    await expect(service.getWallet('missing')).rejects.toMatchObject({
      status: 404,
    });
  });
});
