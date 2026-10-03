import { DashboardService } from './dashboard.service';
import { PrismaService } from '../../../prisma/prisma.service';

it('distinguishes plans, active subscriptions, subscribers, messages and conversations', async () => {
  const prisma = {
    user: {
      count: jest.fn().mockResolvedValueOnce(100).mockResolvedValueOnce(60),
    },
    subscription: { count: jest.fn().mockResolvedValue(3) },
    chatMessage: { count: jest.fn().mockResolvedValue(400) },
    chatConversation: { count: jest.fn().mockResolvedValue(80) },
    userSubscription: { count: jest.fn().mockResolvedValue(61) },
    payment: { findMany: jest.fn().mockResolvedValue([{ amount: '10.50' }]) },
  };
  const result = await new DashboardService(
    prisma as unknown as PrismaService,
  ).dashboardOverview();
  expect(result).toMatchObject({
    totalUsers: 100,
    totalSubscriptionPlans: 3,
    activeSubscribers: 60,
    activeSubscriptions: 61,
    totalMessages: 400,
    totalConversations: 80,
    totalRevenue: 10.5,
    totalSubscriptions: 3,
    totalConversions: 400,
  });
  expect(prisma.userSubscription.count).toHaveBeenCalledWith({
    where: {
      isActive: true,
      startsAt: { lte: expect.any(Date) },
      endsAt: { gt: expect.any(Date) },
    },
  });
});
