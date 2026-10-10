import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TelegramService } from './telegram.service';
import { TelegramWebhookController } from './telegram-webhook.controller';
import { TelegramAiService } from './telegram-ai.service';
import { TelegramConnectController } from './telegram-connect.controller';
import { PrismaModule } from '../../../prisma/prisma.module';
import { ChatModule } from '../chat/chat.module';
import { JwtModule } from '@nestjs/jwt';
import { AuthModule } from '../auth/auth.module';
import { TelegramMiniAppController } from './telegram-mini-app.controller';
import { TelegramMiniAppService } from './telegram-mini-app.service';
import { TelegramQueueService } from './telegram-queue.service';
import { PublishingModule } from '../publishing/publishing.module';

@Module({
  imports: [
    PublishingModule,
    ConfigModule,
    PrismaModule,
    ChatModule,
    AuthModule,
    JwtModule.register({}),
  ],
  controllers: [
    TelegramWebhookController,
    TelegramConnectController,
    TelegramMiniAppController,
  ],
  providers: [
    TelegramService,
    TelegramAiService,
    TelegramMiniAppService,
    TelegramQueueService,
  ],
})
export class TelegramModule {}
