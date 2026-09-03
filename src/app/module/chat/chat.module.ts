import { Module } from '@nestjs/common';
import { CreditModule } from '../credit/credit.module';
import { ChatController } from './chat.controller';
import { ChatService } from './chat.service';

@Module({
  imports: [CreditModule],
  controllers: [ChatController],
  providers: [ChatService],
})
export class ChatModule {}
