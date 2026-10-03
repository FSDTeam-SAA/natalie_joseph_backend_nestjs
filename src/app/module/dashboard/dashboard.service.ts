import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
export class DashboardService {
  constructor(private readonly prisma: PrismaService) {}

  async dashboardOverview() {
    const now = new Date();
    const [
      totalUsers,
      totalSubscriptions,
      totalConversions,
      payments,
      activeSubscriptions,
      activeSubscribers,
      totalConversations,
    ] = await Promise.all([
      this.prisma.user.count({ where: { role: 'user' } }),
      this.prisma.subscription.count(),
      this.prisma.chatMessage.count(),
      this.prisma.payment.findMany({
        where: { status: 'completed' },
        select: { amount: true },
      }),
      this.prisma.userSubscription.count({
        where: { isActive: true, startsAt: { lte: now }, endsAt: { gt: now } },
      }),
      this.prisma.user.count({
        where: {
          role: 'user',
          subscriptions: {
            some: {
              isActive: true,
              startsAt: { lte: now },
              endsAt: { gt: now },
            },
          },
        },
      }),
      this.prisma.chatConversation.count(),
    ]);

    const totalRevenue = payments.reduce((total, payment) => {
      const amount = Number(payment.amount);
      return Number.isFinite(amount) ? total + amount : total;
    }, 0);

    return {
      totalUsers,
      totalSubscriptions,
      totalConversions,
      totalRevenue,
      // Preserve legacy fields for existing clients; expose unambiguous metrics.
      totalSubscriptionPlans: totalSubscriptions,
      activeSubscriptions,
      activeSubscribers,
      totalMessages: totalConversions,
      totalConversations,
    };
  }
}
