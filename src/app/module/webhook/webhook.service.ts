import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import config from 'src/app/config';
import { PrismaService } from 'src/prisma/prisma.service';
import Stripe from 'stripe';

@Injectable()
export class WebhookService {
  private readonly stripe?: Stripe;
  private readonly logger = new Logger(WebhookService.name);

  constructor(private readonly prisma: PrismaService) {
    if (config.stripe.secretKey) {
      this.stripe = new Stripe(config.stripe.secretKey);
    }
  }

  async handleWebhook(rawBody: Buffer | undefined, signature?: string) {
    if (!this.stripe || !config.stripe.webhookSecret) {
      throw new ServiceUnavailableException('Stripe webhook is not configured');
    }
    if (!rawBody || !signature) {
      throw new BadRequestException(
        'Missing raw request body or Stripe signature',
      );
    }

    let event: Stripe.Event;
    try {
      event = this.stripe.webhooks.constructEvent(
        rawBody,
        signature,
        config.stripe.webhookSecret,
      );
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Invalid event';
      this.logger.warn(`Webhook signature verification failed: ${message}`);
      throw new BadRequestException(`Webhook Error: ${message}`);
    }

    try {
      switch (event.type) {
        case 'payment_intent.succeeded':
          await this.handlePaymentIntentSucceeded(event.data.object);
          break;
        case 'payment_intent.payment_failed':
          await this.handlePaymentIntentFailed(event.data.object);
          break;
        default:
          this.logger.debug(`Unhandled Stripe event: ${event.type}`);
      }
      return { received: true };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Webhook handler failed: ${message}`);
      throw new InternalServerErrorException('Webhook handler failed');
    }
  }

  private async handlePaymentIntentSucceeded(intent: Stripe.PaymentIntent) {
    const payment = await this.prisma.payment.findFirst({
      where: { stripePaymentIntentId: intent.id },
    });
    if (!payment) {
      this.logger.warn(`Payment not found for PaymentIntent ${intent.id}`);
      return;
    }

    const shouldAssignSubscription =
      (intent.metadata.paymentType || payment.paymentType) === 'subscription';

    await this.prisma.$transaction(async (transaction) => {
      await transaction.payment.update({
        where: { id: payment.id },
        data: { status: 'completed' },
      });
      if (shouldAssignSubscription) {
        await transaction.subscription.update({
          where: { id: payment.subscriptionId },
          data: { userId: payment.userId },
        });
      }
    });
  }

  private async handlePaymentIntentFailed(intent: Stripe.PaymentIntent) {
    const payment = await this.prisma.payment.findFirst({
      where: { stripePaymentIntentId: intent.id },
      select: { id: true },
    });
    if (!payment) {
      this.logger.warn(`Payment not found for PaymentIntent ${intent.id}`);
      return;
    }
    await this.prisma.payment.update({
      where: { id: payment.id },
      data: { status: 'failed' },
    });
  }
}
