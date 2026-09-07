import { Module } from '@nestjs/common';
import { CreditModule } from '../credit/credit.module';
import { ChatController } from './chat.controller';
import { ChatService } from './chat.service';
import { AiApi } from '../../helper/ai/aiapi';

@Module({
  imports: [CreditModule],
  controllers: [ChatController],
  providers: [ChatService, AiApi],
})
export class ChatModule {}
