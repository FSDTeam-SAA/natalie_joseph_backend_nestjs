import { Module } from '@nestjs/common';
import { CompanionsService } from './companions.service';
import { CompanionsController } from './companions.controller';
import { PublishingModule } from '../publishing/publishing.module';

@Module({
  imports: [PublishingModule],
  controllers: [CompanionsController],
  providers: [CompanionsService],
})
export class CompanionsModule {}
