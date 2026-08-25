import { Injectable } from '@nestjs/common';

import config from 'src/app/config';
import { newsletterWelcomeTemplate } from 'src/app/helper/emailTemplates/newsletterWelcome';
import { MailQueueService } from 'src/app/module/queue/mail-queue.service';
import { PrismaService } from 'src/prisma/prisma.service';
import { CreateNewsletterDto } from './dto/create-newsletter.dto';

@Injectable()
export class NewsletterService {
  private readonly adminEmail: string | undefined;

  constructor(
    private readonly prisma: PrismaService,

    private readonly mailQueue: MailQueueService,
  ) {
    this.adminEmail = config.email?.admin || `sauravsarkar.developer@gmail.com`;
  }

  async sendMail(createNewsletterDto: CreateNewsletterDto) {
    const isExist = await this.prisma.newsletter.findFirst({
      where: {
        email: createNewsletterDto.email,
      },
    });

    if (isExist) {
      return isExist;
    }

    // 1. First save newsletter
    const result = await this.prisma.newsletter.create({
      data: {
        email: createNewsletterDto.email,
      },
    });

    // 2. Then add email jobs
    const mails = [
      {
        to: result.email,
        subject: 'Welcome to Elysia',
        html: newsletterWelcomeTemplate(result.email),
      },
    ];

    if (this.adminEmail) {
      mails.push({
        to: this.adminEmail,
        subject: 'New Elysia Waitlist Request',
        html: this.adminNotificationTemplate(result.email),
      });
    }

    await this.mailQueue.sendBulk(mails);

    return result;
  }

  private adminNotificationTemplate(email: string) {
    return `
      <div>
        <h2>New Waitlist Request</h2>
        <p>A new user has requested to join the Elysia waitlist.</p>
        <p><strong>Email:</strong> ${email}</p>
      </div>
    `;
  }
}
