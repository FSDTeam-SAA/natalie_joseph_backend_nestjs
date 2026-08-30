import {
  BadGatewayException,
  BadRequestException,
  HttpException,
  HttpStatus,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import config from 'src/app/config';
import { PrismaService } from 'src/prisma/prisma.service';
import Stripe from 'stripe';

@Injectable()
export class PaymentService {
  private readonly stripe?: Stripe;

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
    if (!this.stripe) {
      throw new ServiceUnavailableException('Stripe is not configured');
    }

    const amount = Math.round(Number(subscription.price) * 100);
    if (!Number.isSafeInteger(amount) || amount <= 0) {
      throw new BadRequestException('Subscription price is invalid');
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
    } catch {
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
}
