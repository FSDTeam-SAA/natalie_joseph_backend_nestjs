import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { NewsletterModule } from './app/module/newsletter/newsletter.module';
import { UserModule } from './app/module/user/user.module';
import { PrismaModule } from './prisma/prisma.module';
import { MailQueueModule } from './app/module/queue/mail-queue.module';

@Module({
  imports: [
    UserModule,
    PrismaModule,
    ConfigModule.forRoot({ isGlobal: true }),
    MailQueueModule,
    NewsletterModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
