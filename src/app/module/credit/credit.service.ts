import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { closeSubscriptionCredits } from './credit-ledger';
import { PrismaService } from 'src/prisma/prisma.service';
import {
  CreditReason,
  Prisma,
} from '../../../../prisma/generated/prisma/client';
import {
  CreateCreditPackageDto,
  UpdateCreditPackageDto,
} from './dto/credit.dto';

@Injectable()
export class CreditService {
  constructor(private readonly prisma: PrismaService) {}

  createPackage(payload: CreateCreditPackageDto) {
    return this.prisma.creditPackage.create({ data: payload });
  }

  getActivePackages() {
    return this.prisma.creditPackage.findMany({
      where: { isActive: true },
      orderBy: { credits: 'asc' },
    });
  }

  async updatePackage(id: string, payload: UpdateCreditPackageDto) {
    await this.getPackage(id);
    return this.prisma.creditPackage.update({ where: { id }, data: payload });
  }

  async deactivatePackage(id: string) {
    await this.getPackage(id);
    return this.prisma.creditPackage.update({
      where: { id },
      data: { isActive: false },
    });
  }

  async getWallet(userId: string) {
    return this.prisma.$transaction(async (tx) => {
      await this.expirePurchasedCredits(tx, userId);
      const user = await tx.user.findUnique({
        where: { id: userId },
        select: {
          creditBalance: true,
          creditTransactions: {
            orderBy: { createdAt: 'desc' },
            take: 50,
          },
          purchasedCreditLots: {
            where: {
              remainingAmount: { gt: 0 },
              expiresAt: { gt: new Date() },
            },
            orderBy: { expiresAt: 'asc' },
            select: { id: true, remainingAmount: true, expiresAt: true },
          },
        },
      });
      if (!user) throw new NotFoundException('User not found');
      return { ...user, ...(await this.checkLowCredit(tx, userId)) };
    });
  }

  async expirePurchasedCredits(tx: Prisma.TransactionClient, userId: string) {
    // All credit consumers/expiry jobs use the same wallet lock.
    await tx.$queryRaw`SELECT id FROM users WHERE id = ${userId} FOR UPDATE`;
    await closeSubscriptionCredits(tx, userId, true);
    const now = new Date();
    const expired = await tx.purchasedCreditLot.findMany({
      where: { userId, expiresAt: { lte: now }, remainingAmount: { gt: 0 } },
      select: { id: true, remainingAmount: true },
    });
    const expiredAmount = expired.reduce(
      (total, lot) => total + lot.remainingAmount,
      0,
    );
    if (expiredAmount === 0) return 0;

    await tx.purchasedCreditLot.updateMany({
      where: { id: { in: expired.map((lot) => lot.id) } },
      data: { remainingAmount: 0 },
    });
    const user = await tx.user.update({
      where: { id: userId },
      data: { creditBalance: { decrement: expiredAmount } },
    });
    let balance = user.creditBalance + expiredAmount;
    for (const lot of expired) {
      await tx.creditTransaction.create({
        data: {
          userId,
          direction: 'debit',
          reason: 'expiry',
          amount: lot.remainingAmount,
          referenceId: lot.id,
          balanceBefore: balance,
          balanceAfter: balance - lot.remainingAmount,
        },
      });
      balance -= lot.remainingAmount;
    }
    await tx.notification.create({
      data: {
        userId,
        type: 'credit_expiry',
        title: 'Purchased credits expired',
        body: `${expiredAmount} unused credits reached their 90-day expiry.`,
      },
    });
    return expiredAmount;
  }

  async consumeCredits(
    tx: Prisma.TransactionClient,
    userId: string,
    amount: number,
    context: {
      reason: CreditReason;
      companionId?: string;
      referenceId?: string;
      message?: boolean;
    } = { reason: 'extra_message' },
  ) {
    if (!Number.isSafeInteger(amount) || amount < 0)
      throw new BadRequestException('Invalid credit amount');
    await this.expirePurchasedCredits(tx, userId);
    const now = new Date();
    const subscription = await tx.userSubscription.findFirst({
      where: {
        userId,
        isActive: true,
        startsAt: { lte: now },
        endsAt: { gt: now },
      },
      orderBy: { endsAt: 'desc' },
    });
    if (!subscription) return null;
    const wallet = await tx.user.findUniqueOrThrow({
      where: { id: userId },
      select: { creditBalance: true },
    });

    const subscriptionAvailable = Math.max(
      subscription.creditAllowance - subscription.creditsUsed,
      0,
    );
    const fromSubscription = Math.min(subscriptionAvailable, amount);
    const fromPurchased = amount - fromSubscription;

    if (fromPurchased > 0) {
      const user = await tx.user.findUniqueOrThrow({
        where: { id: userId },
        select: { creditBalance: true },
      });
      if (user.creditBalance < fromPurchased) return null;
    }

    if (fromSubscription > 0) {
      const updated = await tx.userSubscription.updateMany({
        where: { id: subscription.id, creditsUsed: subscription.creditsUsed },
        data: {
          creditsUsed: { increment: fromSubscription },
        },
      });
      if (updated.count === 0) return null;
    }

    if (fromPurchased > 0) {
      let remaining = fromPurchased;
      const lots = await tx.purchasedCreditLot.findMany({
        where: { userId, remainingAmount: { gt: 0 }, expiresAt: { gt: now } },
        orderBy: [{ expiresAt: 'asc' }, { purchasedAt: 'asc' }],
      });
      for (const lot of lots) {
        if (remaining === 0) break;
        const debit = Math.min(lot.remainingAmount, remaining);
        const updated = await tx.purchasedCreditLot.updateMany({
          where: { id: lot.id, remainingAmount: { gte: debit } },
          data: { remainingAmount: { decrement: debit } },
        });
        if (updated.count === 0)
          throw new ConflictException('Credit lot changed; retry');
        remaining -= debit;
      }
      if (remaining > 0)
        throw new ConflictException('Credit wallet is inconsistent');
      const debited = await tx.user.updateMany({
        where: { id: userId, creditBalance: { gte: fromPurchased } },
        data: { creditBalance: { decrement: fromPurchased } },
      });
      if (debited.count === 0)
        throw new ConflictException('Credit wallet changed; retry');
    }

    if (context.message)
      await tx.userSubscription.update({
        where: { id: subscription.id },
        data: { messagesUsed: { increment: 1 } },
      });
    for (const [source, debit, before] of [
      ['subscription', fromSubscription, subscriptionAvailable],
      ['purchased', fromPurchased, wallet.creditBalance],
    ] as const) {
      if (debit > 0)
        await tx.creditTransaction.create({
          data: {
            userId,
            source,
            companionId: context.companionId,
            referenceId: context.referenceId,
            direction: 'debit',
            reason: context.reason,
            amount: debit,
            balanceBefore: before,
            balanceAfter: before - debit,
          },
        });
    }
    await this.checkLowCredit(tx, userId);
    return { subscription, fromSubscription, fromPurchased };
  }

  async getCosts(tx: Prisma.TransactionClient = this.prisma) {
    const costs = { message: 1, photo: 5, voice: 3, low_credit_threshold: 10 };
    for (const row of await tx.creditCost.findMany()) {
      if (row.action in costs)
        costs[row.action as keyof typeof costs] = row.credits;
    }
    return costs;
  }

  async checkLowCredit(tx: Prisma.TransactionClient, userId: string) {
    await tx.$queryRaw`SELECT id FROM users WHERE id = ${userId} FOR UPDATE`;
    const user = await tx.user.findUniqueOrThrow({ where: { id: userId } });
    const now = new Date();
    const subscription = await tx.userSubscription.findFirst({
      where: {
        userId,
        isActive: true,
        startsAt: { lte: now },
        endsAt: { gt: now },
      },
    });
    const totalCredits =
      user.creditBalance +
      Math.max(
        0,
        (subscription?.creditAllowance ?? 0) - (subscription?.creditsUsed ?? 0),
      );
    const threshold = (await this.getCosts(tx)).low_credit_threshold;
    const lowCredit = totalCredits <= threshold;
    if (lowCredit && !user.lowCreditNotified)
      await tx.notification.create({
        data: {
          userId,
          type: 'low_credit',
          title: 'Credits running low',
          body: `You have ${totalCredits} credits remaining.`,
        },
      });
    if (lowCredit !== user.lowCreditNotified)
      await tx.user.update({
        where: { id: userId },
        data: { lowCreditNotified: lowCredit },
      });
    return { totalCredits, lowCredit, threshold };
  }

  @Cron(CronExpression.EVERY_HOUR)
  async expireDueCredits() {
    let cursor: string | undefined;
    while (true) {
      const users = await this.prisma.user.findMany({
        where: {
          purchasedCreditLots: {
            some: {
              expiresAt: { lte: new Date() },
              remainingAmount: { gt: 0 },
            },
          },
        },
        select: { id: true },
        orderBy: { id: 'asc' },
        take: 100,
        ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      });
      if (!users.length) break;
      for (const user of users)
        await this.prisma.$transaction(async (tx) => {
          await this.expirePurchasedCredits(tx, user.id);
          await this.checkLowCredit(tx, user.id);
        });
      cursor = users[users.length - 1].id;
    }
  }

  private async getPackage(id: string) {
    const creditPackage = await this.prisma.creditPackage.findUnique({
      where: { id },
    });
    if (!creditPackage) throw new NotFoundException('Credit package not found');
    return creditPackage;
  }
}
