import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { CreditModule } from '../credit/credit.module';
import { LifestyleService } from './lifestyle.service';
import { DailyDeliveryService } from './daily-delivery.service';
import { LifestyleAdminController } from './lifestyle.controller';
@Module({
  imports: [ConfigModule, CreditModule],
  controllers: [LifestyleAdminController],
  providers: [LifestyleService, DailyDeliveryService],
  exports: [LifestyleService],
})
export class LifestyleModule {}
