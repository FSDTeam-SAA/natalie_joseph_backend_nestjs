import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { WhatsAppWebhookController } from './whatsapp-webhook.controller';
import { JwtModule } from '@nestjs/jwt';
import { WhatsAppController } from './whatsapp.controller';
import { WhatsAppService } from './whatsapp.service';
import { WhatsAppInboundService } from './whatsapp-inbound.service';
import { PrismaModule } from '../../../prisma/prisma.module';
import { ChatModule } from '../chat/chat.module';
import { WhatsAppAiService } from './whatsapp-ai.service';
import { WhatsAppConnectController } from './whatsapp-connect.controller';

@Module({
  imports: [ConfigModule, JwtModule.register({}), PrismaModule, ChatModule],
  controllers: [
    WhatsAppWebhookController,
    WhatsAppController,
    WhatsAppConnectController,
  ],
  providers: [WhatsAppService, WhatsAppInboundService, WhatsAppAiService],
  exports: [WhatsAppService],
})
export class WhatsAppModule {}
