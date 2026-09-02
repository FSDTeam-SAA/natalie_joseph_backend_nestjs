import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
export class DashboardService {
  constructor(private readonly prisma: PrismaService) {}

  async dashboardOverview() {
    const [totalUsers, totalSubscriptions, totalConversions, payments] =
      await Promise.all([
        this.prisma.user.count({ where: { role: 'user' } }),
        this.prisma.subscription.count(),
        this.prisma.chatMessage.count(),
        this.prisma.payment.findMany({
          where: { status: 'completed' },
          select: { amount: true },
        }),
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
    };
  }
}
