import { Module } from '@nestjs/common';
import { GiftController } from './gift.controller';
import { GiftService } from './gift.service';
import { CreditModule } from '../credit/credit.module';

@Module({
  imports: [CreditModule],
  controllers: [GiftController],
  providers: [GiftService],
})
export class GiftModule {}
