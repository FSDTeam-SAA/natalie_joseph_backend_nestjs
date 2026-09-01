import {
  BadGatewayException,
  BadRequestException,
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import config from 'src/app/config';
import { PrismaService } from 'src/prisma/prisma.service';
import Stripe from 'stripe';

@Injectable()
export class PaymentService {
  private readonly stripe?: Stripe;
  private readonly logger = new Logger(PaymentService.name);

  constructor(private readonly prisma: PrismaService) {
    if (config.stripe.secretKey) {
      this.stripe = new Stripe(config.stripe.secretKey);
    }
  }

  async paySubscriber(userId: string, subscriberId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });
    if (!user) {
      throw new HttpException('User not found', HttpStatus.NOT_FOUND);
    }
    const subscription = await this.prisma.subscription.findUnique({
      where: { id: subscriberId },
    });
    if (!subscription) {
      throw new HttpException('Subscription not found', HttpStatus.NOT_FOUND);
    }
    if (!subscription.isActive) {
      throw new BadRequestException('Subscription is not active');
    }
    const amount = Math.round(Number(subscription.price) * 100);
    if (!Number.isSafeInteger(amount) || amount < 0) {
      throw new BadRequestException('Subscription price is invalid');
    }

    if (amount === 0) {
      const startsAt = new Date();
      const endsAt = new Date(startsAt);
      endsAt.setUTCDate(endsAt.getUTCDate() + subscription.durationDays);

      const payment = await this.prisma.$transaction(async (transaction) => {
        await transaction.userSubscription.updateMany({
          where: { userId: user.id, isActive: true },
          data: { isActive: false },
        });

        await transaction.userSubscription.create({
          data: {
            userId: user.id,
            subscriptionId: subscription.id,
            messageLimit: subscription.messageLimit,
            startsAt,
            endsAt,
          },
        });

        await transaction.user.update({
          where: { id: user.id },
          data: { isSubscribed: true },
        });

        return transaction.payment.create({
          data: {
            userId: user.id,
            subscriptionId: subscription.id,
            amount: subscription.price,
            paymentType: 'subscription',
            status: 'completed',
          },
        });
      });

      return { payment, clientSecret: null, activated: true };
    }

    if (!this.stripe) {
      throw new ServiceUnavailableException('Stripe is not configured');
    }

    let paymentIntent: Stripe.PaymentIntent;
    try {
      paymentIntent = await this.stripe.paymentIntents.create({
        amount,
        currency: 'usd',
        automatic_payment_methods: { enabled: true },
        metadata: {
          paymentType: 'subscription',
          userId: user.id,
          subscriptionId: subscription.id,
        },
      });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Stripe PaymentIntent creation failed: ${message}`);
      throw new BadGatewayException('Unable to initiate Stripe payment');
    }

    try {
      const payment = await this.prisma.payment.create({
        data: {
          userId: user.id,
          subscriptionId: subscription.id,
          amount: subscription.price,
          paymentType: 'subscription',
          stripePaymentIntentId: paymentIntent.id,
        },
      });

      return {
        payment,
        clientSecret: paymentIntent.client_secret,
      };
    } catch (error) {
      try {
        await this.stripe.paymentIntents.cancel(paymentIntent.id);
      } catch {
        // The webhook can safely ignore an intent without a local payment row.
      }
      throw error;
    }
  }

  async buyCredits(userId: string, packageId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new HttpException('User not found', HttpStatus.NOT_FOUND);
    if (!this.stripe) {
      throw new ServiceUnavailableException('Stripe is not configured');
    }

    const creditPackage = await this.prisma.creditPackage.findFirst({
      where: { id: packageId, isActive: true },
    });
    if (!creditPackage) throw new BadRequestException('Invalid credit package');

    const amountInCents = Math.round(Number(creditPackage.price) * 100);
    if (!Number.isSafeInteger(amountInCents) || amountInCents < 50) {
      throw new BadRequestException('Credit package price is invalid');
    }

    let paymentIntent: Stripe.PaymentIntent;
    try {
      paymentIntent = await this.stripe.paymentIntents.create({
        amount: amountInCents,
        currency: creditPackage.currency.toLowerCase(),
        automatic_payment_methods: { enabled: true },
        metadata: {
          paymentType: 'credits',
          userId,
          credits: String(creditPackage.credits),
          creditPackageId: creditPackage.id,
        },
      });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Stripe credit PaymentIntent failed: ${message}`);
      throw new BadGatewayException('Unable to initiate Stripe payment');
    }

    try {
      const payment = await this.prisma.payment.create({
        data: {
          userId,
          creditPackageId: creditPackage.id,
          creditAmount: creditPackage.credits,
          amount: creditPackage.price,
          paymentType: 'credits',
          stripePaymentIntentId: paymentIntent.id,
        },
      });
      return { payment, clientSecret: paymentIntent.client_secret };
    } catch (error) {
      try {
        await this.stripe.paymentIntents.cancel(paymentIntent.id);
      } catch {
        // A Stripe webhook without a local payment row is ignored safely.
      }
      throw error;
    }
  }
}
