import { closeSubscriptionCredits } from '../module/credit/credit-ledger';
import { CreditService } from '../module/credit/credit.service';
import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
export class SubscribePaymentCronService implements OnApplicationBootstrap {
  private readonly logger = new Logger(SubscribePaymentCronService.name);
  private isRunning = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly credits: CreditService,
  ) {}

  onApplicationBootstrap() {
    void this.expireSubscriptions();
  }

  @Cron(CronExpression.EVERY_HOUR, {
    name: 'expire-user-subscriptions',
  })
  async expireSubscriptions() {
    if (this.isRunning) {
      this.logger.warn('Subscription expiry cron is already running');
      return;
    }

    this.isRunning = true;
    const now = new Date();
    this.logger.log(`Cron started at ${now.toISOString()}`);

    try {
      let expiredCount = 0;
      while (true) {
        const due = await this.prisma.userSubscription.findMany({
          where: { isActive: true, endsAt: { lte: now } },
          select: { userId: true },
          take: 100,
        });
        if (!due.length) break;
        for (const { userId } of due)
          await this.prisma.$transaction(async (tx) => {
            await tx.$queryRaw`SELECT id FROM users WHERE id = ${userId} FOR UPDATE`;
            await closeSubscriptionCredits(tx, userId, true);
            await this.credits.expirePurchasedCredits(tx, userId);
            await this.credits.checkLowCredit(tx, userId);
          });
        expiredCount += due.length;
      }
      const result = { expiredSubscriptions: expiredCount };

      this.logger.log(
        `Cron completed at ${new Date().toISOString()}: ${JSON.stringify(result)}`,
      );
    } catch (error: unknown) {
      const message = error instanceof Error ? error.stack : String(error);
      this.logger.error(`Subscription expiry cron failed: ${message}`);
    } finally {
      this.isRunning = false;
    }
  }
}
