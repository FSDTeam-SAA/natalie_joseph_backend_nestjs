import { Prisma } from '../../../../prisma/generated/prisma/client';

// Caller holds the user's wallet row lock for all grants, debits and expiry.
export async function closeSubscriptionCredits(
  tx: Prisma.TransactionClient,
  userId: string,
  expiredOnly = false,
) {
  const subscriptions = await tx.userSubscription.findMany({
    where: {
      userId,
      isActive: true,
      ...(expiredOnly ? { endsAt: { lte: new Date() } } : {}),
    },
  });
  for (const subscription of subscriptions) {
    const remaining = Math.max(
      0,
      subscription.creditAllowance - subscription.creditsUsed,
    );
    if (remaining > 0)
      await tx.creditTransaction.create({
        data: {
          userId,
          source: 'subscription',
          direction: 'debit',
          reason: 'subscription_expiry',
          amount: remaining,
          balanceBefore: remaining,
          balanceAfter: 0,
          referenceId: subscription.id,
        },
      });
    await tx.userSubscription.update({
      where: { id: subscription.id },
      data: { isActive: false },
    });
  }
  if (subscriptions.length) {
    const active = await tx.userSubscription.count({
      where: {
        userId,
        isActive: true,
        startsAt: { lte: new Date() },
        endsAt: { gt: new Date() },
      },
    });
    await tx.user.update({
      where: { id: userId },
      data: { isSubscribed: active > 0 },
    });
  }
}

export async function grantSubscriptionCredits(
  tx: Prisma.TransactionClient,
  data: Prisma.UserSubscriptionUncheckedCreateInput,
) {
  await closeSubscriptionCredits(tx, data.userId);
  const subscription = await tx.userSubscription.create({ data });
  if (subscription.creditAllowance > 0)
    await tx.creditTransaction.create({
      data: {
        userId: data.userId,
        source: 'subscription',
        direction: 'credit',
        reason: 'subscription_grant',
        amount: subscription.creditAllowance,
        balanceBefore: 0,
        balanceAfter: subscription.creditAllowance,
        referenceId: subscription.id,
      },
    });
  await tx.user.update({
    where: { id: data.userId },
    data: { isSubscribed: true, lowCreditNotified: false },
  });
  await tx.notification.create({
    data: {
      userId: data.userId,
      type: 'subscription',
      title: 'Subscription activated',
      body: `Your subscription is available until ${subscription.endsAt.toISOString()}.`,
      referenceId: subscription.id,
    },
  });
  return subscription;
}
