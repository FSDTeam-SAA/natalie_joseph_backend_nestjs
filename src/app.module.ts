import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { NewsletterModule } from './app/module/newsletter/newsletter.module';
import { UserModule } from './app/module/user/user.module';
import { PrismaModule } from './prisma/prisma.module';
import { MailQueueModule } from './app/module/queue/mail-queue.module';
import { AuthModule } from './app/module/auth/auth.module';
import { SubscriptionModule } from './app/module/subscription/subscription.module';
import { PaymentModule } from './app/module/payment/payment.module';
import { WebhookModule } from './app/module/webhook/webhook.module';
import { CompanionsModule } from './app/module/companions/companions.module';
import { ChatModule } from './app/module/chat/chat.module';
import { SubscribePaymentCronService } from './app/helper/subscribePayment.cron';

@Module({
  imports: [
    UserModule,
    PrismaModule,
    ConfigModule.forRoot({ isGlobal: true }),
    ScheduleModule.forRoot(),
    MailQueueModule,
    NewsletterModule,
    AuthModule,
    SubscriptionModule,
    PaymentModule,
    WebhookModule,
    CompanionsModule,
    ChatModule,
  ],
  controllers: [AppController],
  providers: [AppService, SubscribePaymentCronService],
})
export class AppModule {}
