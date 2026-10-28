import { Module } from '@nestjs/common';
import { CreditModule } from '../credit/credit.module';
import { ChatController } from './chat.controller';
import { ChatService } from './chat.service';
import { AiApi } from '../../helper/ai/aiapi';
import { LifestyleModule } from '../lifestyle/lifestyle.module';

@Module({
  imports: [CreditModule, LifestyleModule],
  controllers: [ChatController],
  providers: [ChatService, AiApi],
  exports: [ChatService],
})
export class ChatModule {}
