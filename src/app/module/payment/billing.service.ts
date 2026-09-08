import {
  BadRequestException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import config from 'src/app/config';
import { PrismaService } from 'src/prisma/prisma.service';
import Stripe from 'stripe';
import {
  closeSubscriptionCredits,
  grantSubscriptionCredits,
} from '../credit/credit-ledger';

const remoteId = (value: string | { id: string } | null | undefined) =>
  typeof value === 'string' ? value : value?.id;

@Injectable()
export class BillingService {
  private readonly stripe = config.stripe.secretKey
    ? new Stripe(config.stripe.secretKey)
    : undefined;
  constructor(private readonly prisma: PrismaService) {}
  private gateway() {
    if (!this.stripe)
      throw new ServiceUnavailableException('Stripe is not configured');
    return this.stripe;
  }

  async status(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        billingSubscriptionId: true,
        billingStatus: true,
        cancelAtPeriodEnd: true,
        subscriptions: {
          where: {
            isActive: true,
            startsAt: { lte: new Date() },
            endsAt: { gt: new Date() },
          },
          take: 1,
          orderBy: { endsAt: 'desc' },
          include: { subscription: true },
        },
      },
    });
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  async portal(userId: string) {
    if (!config.frontendUrl)
      throw new ServiceUnavailableException(
        'FRONTEND_URL is required for the billing portal',
      );
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
    });
    if (!user.stripeAccountId)
      throw new BadRequestException('No billing customer exists');
    const session = await this.gateway().billingPortal.sessions.create({
      customer: user.stripeAccountId,
      return_url: config.frontendUrl,
    });
    return { url: session.url };
  }

  async start(userId: string, planId: string) {
    const stripe = this.gateway();
    return this.prisma.$transaction(
      async (tx) => {
        await tx.$queryRaw`SELECT id FROM users WHERE id = ${userId} FOR UPDATE`;
        const user = await tx.user.findUniqueOrThrow({ where: { id: userId } });
        const plan = await tx.subscription.findFirst({
          where: { id: planId, isActive: true },
        });
        if (!plan) throw new NotFoundException('Subscription not found');
        const amount = Math.round(Number(plan.price) * 100);
        if (!Number.isSafeInteger(amount) || amount < 50)
          throw new BadRequestException('Paid plan must cost at least $0.50');
        if (user.billingSubscriptionId) {
          const existing = await stripe.subscriptions.retrieve(
            user.billingSubscriptionId,
            { expand: ['latest_invoice.confirmation_secret'] },
          );
          if (!['canceled', 'incomplete_expired'].includes(existing.status)) {
            if (
              existing.status === 'incomplete' &&
              existing.items.data[0]?.price.metadata.planId === planId
            )
              return this.paymentResult(existing);
            throw new BadRequestException(
              'A recurring subscription already exists; use the upgrade or cancellation endpoint',
            );
          }
        }
        // Retire old one-time subscription checkouts before starting recurring
        // billing, so an old client secret cannot buy a second, competing plan.
        const legacyPayments = await tx.payment.findMany({
          where: {
            userId,
            paymentType: 'subscription',
            stripePaymentIntentId: { not: null },
            status: { in: ['pending', 'failed'] },
          },
        });
        for (const payment of legacyPayments) {
          const intent = await stripe.paymentIntents.retrieve(
            payment.stripePaymentIntentId!,
          );
          if (intent.status === 'succeeded')
            throw new BadRequestException(
              'Your previous payment is being activated; retry after its webhook is processed',
            );
          if (intent.status !== 'canceled')
            await stripe.paymentIntents.cancel(intent.id);
          await tx.payment.update({
            where: { id: payment.id },
            data: { status: 'failed' },
          });
        }
        const customerId =
          user.stripeAccountId ||
          (
            await stripe.customers.create(
              { email: user.email, metadata: { userId } },
              { idempotencyKey: `customer:${userId}` },
            )
          ).id;
        const price = await this.price(plan);
        const subscription = await stripe.subscriptions.create(
          {
            customer: customerId,
            items: [{ price: price.id }],
            payment_behavior: 'default_incomplete',
            payment_settings: {
              save_default_payment_method: 'on_subscription',
              payment_method_types: ['card'],
            },
            metadata: { userId },
            expand: ['latest_invoice.confirmation_secret'],
          },
          {
            idempotencyKey: `subscription:${userId}:${user.billingSubscriptionId ?? 'initial'}:${plan.id}`,
          },
        );
        await tx.user.update({
          where: { id: userId },
          data: {
            stripeAccountId: customerId,
            billingSubscriptionId: subscription.id,
            billingStatus: subscription.status,
            cancelAtPeriodEnd: false,
          },
        });
        return this.paymentResult(subscription);
      },
      { maxWait: 10000, timeout: 90000 },
    );
  }

  async upgrade(userId: string, planId: string) {
    const stripe = this.gateway();
    return this.prisma.$transaction(
      async (tx) => {
        await tx.$queryRaw`SELECT id FROM users WHERE id = ${userId} FOR UPDATE`;
        const user = await tx.user.findUniqueOrThrow({ where: { id: userId } });
        if (!user.billingSubscriptionId)
          throw new BadRequestException('Start a recurring subscription first');
        const current = await stripe.subscriptions.retrieve(
          user.billingSubscriptionId,
        );
        if (current.status !== 'active' || current.cancel_at_period_end)
          throw new BadRequestException(
            'An active, renewing subscription is required',
          );
        const plan = await tx.subscription.findFirst({
          where: { id: planId, isActive: true },
        });
        if (!plan) throw new NotFoundException('Plan not found');
        const item = current.items.data[0];
        const amount = Math.round(Number(plan.price) * 100);
        if (
          !item ||
          !Number.isSafeInteger(amount) ||
          amount <= (item.price.unit_amount ?? 0)
        )
          throw new BadRequestException(
            'Upgrade requires a higher-priced plan',
          );
        const price = await this.price(plan);
        // A fresh 30-day cycle, with unused paid time credited by Stripe.
        // The plan only changes if the saved card can pay the upgrade invoice.
        const updated = await stripe.subscriptions.update(
          current.id,
          {
            items: [{ id: item.id, price: price.id }],
            billing_cycle_anchor: 'now',
            proration_behavior: 'always_invoice',
            payment_behavior: 'error_if_incomplete',
            expand: ['latest_invoice.confirmation_secret'],
          },
          {
            idempotencyKey: `upgrade:${current.id}:${item.current_period_start}:${price.id}`,
          },
        );
        return this.paymentResult(updated);
      },
      { maxWait: 10000, timeout: 90000 },
    );
  }

  async cancel(userId: string) {
    const stripe = this.gateway();
    return this.prisma.$transaction(
      async (tx) => {
        await tx.$queryRaw`SELECT id FROM users WHERE id = ${userId} FOR UPDATE`;
        const user = await tx.user.findUniqueOrThrow({ where: { id: userId } });
        if (user.billingSubscriptionId) {
          const subscription = await stripe.subscriptions.retrieve(
            user.billingSubscriptionId,
          );
          if (
            !['canceled', 'incomplete_expired'].includes(subscription.status)
          ) {
            if (subscription.status === 'incomplete')
              await stripe.subscriptions.cancel(subscription.id);
            else
              await stripe.subscriptions.update(subscription.id, {
                cancel_at_period_end: true,
              });
          }
        }
        // Existing paid access lasts until endsAt; free/legacy plans never auto-renew.
        await tx.user.update({
          where: { id: userId },
          data: { cancelAtPeriodEnd: true },
        });
        const subscription = await tx.userSubscription.findFirst({
          where: { userId, isActive: true, endsAt: { gt: new Date() } },
          orderBy: { endsAt: 'desc' },
        });
        return {
          cancelAtPeriodEnd: true,
          accessUntil: subscription?.endsAt ?? null,
        };
      },
      { maxWait: 10000, timeout: 90000 },
    );
  }

  async invoicePaid(invoice: Stripe.Invoice) {
    const subscriptionId = remoteId(
      invoice.parent?.subscription_details?.subscription,
    );
    if (!subscriptionId) return;
    const stripe = this.gateway();
    const remote = await stripe.subscriptions.retrieve(subscriptionId);
    const userId = remote.metadata.userId;
    if (!userId) return;
    await this.prisma.$transaction(
      async (tx) => {
        await tx.$queryRaw`SELECT id FROM users WHERE id = ${userId} FOR UPDATE`;
        const user = await tx.user.findUnique({ where: { id: userId } });
        if (!user) return;
        if (!user.billingSubscriptionId)
          throw new ServiceUnavailableException(
            'Subscription creation has not committed; retry this invoice',
          );
        if (user.billingSubscriptionId !== subscriptionId) return;
        const existing = await tx.payment.findUnique({
          where: { stripeInvoiceId: invoice.id },
        });
        if (existing?.status === 'completed') return;
        // Retrieve again under the lock so out-of-order events cannot restore an old plan.
        const current = await stripe.subscriptions.retrieve(subscriptionId);
        const item = current.items.data[0];
        const billedLine = invoice.lines.data.find(
          (line) =>
            line.parent?.subscription_item_details &&
            !line.parent.subscription_item_details.proration &&
            line.amount >= 0,
        );
        const billedPriceId = remoteId(
          billedLine?.pricing?.price_details?.price,
        );
        const price = billedPriceId
          ? await stripe.prices.retrieve(billedPriceId)
          : undefined;
        const planId = price?.metadata.planId;
        await tx.payment.upsert({
          where: { stripeInvoiceId: invoice.id },
          create: {
            userId,
            subscriptionId: planId ?? null,
            stripeInvoiceId: invoice.id,
            amount: (invoice.amount_paid / 100).toFixed(2),
            paymentType: 'subscription',
            status: 'completed',
          },
          update: {
            status: 'completed',
            amount: (invoice.amount_paid / 100).toFixed(2),
          },
        });
        if (
          !item ||
          !price ||
          !planId ||
          !billedLine ||
          billedLine.period.start !== item.current_period_start ||
          billedLine.period.end !== item.current_period_end ||
          price.id !== item.price.id ||
          remoteId(current.latest_invoice) !== invoice.id ||
          current.status !== 'active' ||
          item.current_period_end * 1000 <= Date.now()
        )
          return;
        if (
          ![price.metadata.messageLimit, price.metadata.creditAllowance].every(
            (value) =>
              value !== undefined &&
              Number.isSafeInteger(Number(value)) &&
              Number(value) >= 0 &&
              Number(value) <= 2147483647,
          )
        )
          throw new BadRequestException(
            'Invalid subscription allowance metadata',
          );
        await grantSubscriptionCredits(tx, {
          userId,
          subscriptionId: planId,
          stripeInvoiceId: invoice.id,
          stripeSubscriptionId: subscriptionId,
          messageLimit: Number(price.metadata.messageLimit),
          creditAllowance: Number(price.metadata.creditAllowance),
          startsAt: new Date(item.current_period_start * 1000),
          endsAt: new Date(item.current_period_end * 1000),
        });
        await tx.user.update({
          where: { id: userId },
          data: {
            billingStatus: current.status,
            cancelAtPeriodEnd: current.cancel_at_period_end,
          },
        });
      },
      { maxWait: 10000, timeout: 60000 },
    );
  }

  async subscriptionChanged(event: Stripe.Subscription) {
    const userId = event.metadata.userId;
    if (!userId) return;
    await this.prisma.$transaction(
      async (tx) => {
        await tx.$queryRaw`SELECT id FROM users WHERE id = ${userId} FOR UPDATE`;
        const user = await tx.user.findUnique({ where: { id: userId } });
        if (!user || user.billingSubscriptionId !== event.id) return;
        const current = await this.gateway().subscriptions.retrieve(event.id);
        const terminal = [
          'canceled',
          'unpaid',
          'incomplete_expired',
          'paused',
        ].includes(current.status);
        if (terminal) await closeSubscriptionCredits(tx, userId);
        await tx.user.update({
          where: { id: userId },
          data: {
            billingStatus: current.status,
            cancelAtPeriodEnd: current.cancel_at_period_end,
            ...(terminal ? { isSubscribed: false } : {}),
          },
        });
      },
      { timeout: 60000 },
    );
  }

  async invoiceFailed(invoice: Stripe.Invoice) {
    const subscriptionId = remoteId(
      invoice.parent?.subscription_details?.subscription,
    );
    if (!subscriptionId) return;
    const current = await this.gateway().subscriptions.retrieve(subscriptionId);
    const userId = current.metadata.userId;
    if (
      !userId ||
      remoteId(current.latest_invoice) !== invoice.id ||
      current.status === 'active'
    )
      return;
    await this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM users WHERE id = ${userId} FOR UPDATE`;
      const user = await tx.user.findUnique({ where: { id: userId } });
      if (!user || user.billingSubscriptionId !== subscriptionId) return;
      const paid = await tx.payment.findUnique({
        where: { stripeInvoiceId: invoice.id },
      });
      if (paid?.status === 'completed') return;
      const exists = await tx.notification.findFirst({
        where: { userId, type: 'payment_failed', referenceId: invoice.id },
      });
      if (!exists)
        await tx.notification.create({
          data: {
            userId,
            type: 'payment_failed',
            title: 'Subscription payment failed',
            body: 'Update your payment method to renew access.',
            referenceId: invoice.id,
          },
        });
    });
  }

  private async price(plan: {
    id: string;
    name: string;
    price: string;
    creditAllowance: number;
    messageLimit: number;
    updatedAt: Date;
  }) {
    const amount = Math.round(Number(plan.price) * 100);
    if (!Number.isSafeInteger(amount) || amount < 50)
      throw new BadRequestException('Invalid paid plan price');
    return this.gateway().prices.create(
      {
        currency: 'usd',
        unit_amount: amount,
        recurring: { interval: 'day', interval_count: 30 },
        product_data: { name: plan.name },
        metadata: {
          planId: plan.id,
          creditAllowance: String(plan.creditAllowance),
          messageLimit: String(plan.messageLimit),
        },
      },
      { idempotencyKey: `price:${plan.id}:${plan.updatedAt.toISOString()}` },
    );
  }
  private paymentResult(subscription: Stripe.Subscription) {
    const invoice =
      typeof subscription.latest_invoice === 'object'
        ? subscription.latest_invoice
        : null;
    return {
      stripeSubscriptionId: subscription.id,
      status: String(subscription.status),
      clientSecret: invoice?.confirmation_secret?.client_secret ?? null,
      invoiceUrl: invoice?.hosted_invoice_url ?? null,
      activated: false,
    };
  }
}
