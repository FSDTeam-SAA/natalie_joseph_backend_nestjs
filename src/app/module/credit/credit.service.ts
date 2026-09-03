import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { Prisma } from '../../../../prisma/generated/prisma/client';
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
    await this.prisma.$transaction((tx) =>
      this.expirePurchasedCredits(tx, userId),
    );
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        creditBalance: true,
        creditTransactions: {
          orderBy: { createdAt: 'desc' },
          take: 50,
        },
        purchasedCreditLots: {
          where: { remainingAmount: { gt: 0 }, expiresAt: { gt: new Date() } },
          orderBy: { expiresAt: 'asc' },
          select: { id: true, remainingAmount: true, expiresAt: true },
        },
      },
    });
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  async expirePurchasedCredits(tx: Prisma.TransactionClient, userId: string) {
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
    await tx.user.update({
      where: { id: userId },
      data: { creditBalance: { decrement: expiredAmount } },
    });
    return expiredAmount;
  }

  async consumeCredits(
    tx: Prisma.TransactionClient,
    userId: string,
    amount: number,
  ) {
    const now = new Date();
    await this.expirePurchasedCredits(tx, userId);
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
          messagesUsed: { increment: fromSubscription },
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
        if (updated.count === 0) return null;
        remaining -= debit;
      }
      if (remaining > 0) return null;
      const debited = await tx.user.updateMany({
        where: { id: userId, creditBalance: { gte: fromPurchased } },
        data: { creditBalance: { decrement: fromPurchased } },
      });
      if (debited.count === 0) return null;
    }

    return { subscription, fromSubscription, fromPurchased };
  }

  private async getPackage(id: string) {
    const creditPackage = await this.prisma.creditPackage.findUnique({
      where: { id },
    });
    if (!creditPackage) throw new NotFoundException('Credit package not found');
    return creditPackage;
  }
}
