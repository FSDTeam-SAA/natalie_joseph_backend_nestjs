import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TelegramService } from './telegram.service';
import { TelegramWebhookController } from './telegram-webhook.controller';
import { TelegramAiService } from './telegram-ai.service';
import { TelegramConnectController } from './telegram-connect.controller';
import { PrismaModule } from '../../../prisma/prisma.module';
import { ChatModule } from '../chat/chat.module';
import { JwtModule } from '@nestjs/jwt';

@Module({
  imports: [ConfigModule, PrismaModule, ChatModule, JwtModule.register({})],
  controllers: [TelegramWebhookController, TelegramConnectController],
  providers: [TelegramService, TelegramAiService],
})
export class TelegramModule {}
