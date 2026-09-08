import { BillingService } from './billing.service';
import { Module } from '@nestjs/common';
import { PaymentService } from './payment.service';
import { PaymentController } from './payment.controller';

@Module({
  controllers: [PaymentController],
  providers: [PaymentService, BillingService],
  exports: [PaymentService, BillingService],
})
export class PaymentModule {}
