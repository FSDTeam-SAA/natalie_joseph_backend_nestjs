import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
export class SubscribePaymentCronService implements OnApplicationBootstrap {
  private readonly logger = new Logger(SubscribePaymentCronService.name);
  private isRunning = false;

  constructor(private readonly prisma: PrismaService) {}

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
      // Keep these as separate atomic updates. Interactive transactions can
      // time out behind connection poolers such as Supabase's PgBouncer.
      const expiredSubscriptions =
        await this.prisma.userSubscription.updateMany({
          where: { isActive: true, endsAt: { lte: now } },
          data: { isActive: false },
        });

      const unsubscribedUsers = await this.prisma.user.updateMany({
        where: {
          isSubscribed: true,
          subscriptions: {
            none: {
              isActive: true,
              startsAt: { lte: now },
              endsAt: { gt: now },
            },
          },
        },
        data: { isSubscribed: false },
      });

      // Also repairs a stale false flag if an active subscription exists.
      const subscribedUsers = await this.prisma.user.updateMany({
        where: {
          isSubscribed: false,
          subscriptions: {
            some: {
              isActive: true,
              startsAt: { lte: now },
              endsAt: { gt: now },
            },
          },
        },
        data: { isSubscribed: true },
      });

      const result = {
        expiredSubscriptions: expiredSubscriptions.count,
        usersMarkedUnsubscribed: unsubscribedUsers.count,
        usersMarkedSubscribed: subscribedUsers.count,
      };

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
