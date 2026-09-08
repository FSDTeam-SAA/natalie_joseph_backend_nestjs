import { Module } from '@nestjs/common';
import { CreditModule } from '../credit/credit.module';
import {
  EngagementController,
  EngagementAdminController,
} from './engagement.controller';
import { EngagementService } from './engagement.service';

@Module({
  imports: [CreditModule],
  controllers: [EngagementController, EngagementAdminController],
  providers: [EngagementService],
})
export class EngagementModule {}
