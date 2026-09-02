import { Injectable } from '@nestjs/common';

import config from 'src/app/config';
import buildWhereConditions from 'src/app/helper/buildWhereConditions';
import { newsletterWelcomeTemplate } from 'src/app/helper/emailTemplates/newsletterWelcome';
import paginationHelper, { IOptions } from 'src/app/helper/pagenation';
import { IFilterParams } from 'src/app/helper/pick';
import { MailQueueService } from 'src/app/module/queue/mail-queue.service';
import { PrismaService } from 'src/prisma/prisma.service';
import { BroadcastNewsletterDto } from './dto/broadcast-newsletter.dto';
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

  async getAllNewsletter(params: IFilterParams, options: IOptions) {
    const { page, limit, skip, sortBy, sortOrder } = paginationHelper(options);
    const whenCondition = buildWhereConditions(params, ['email']);

    const [result, total] = await Promise.all([
      this.prisma.newsletter.findMany({
        where: whenCondition,
        skip,
        take: limit,
        orderBy: {
          [sortBy]: sortOrder,
        },
      }),
      this.prisma.newsletter.count({
        where: whenCondition,
      }),
    ]);

    return {
      data: result,
      meta: { page, limit, total },
    };
  }

  async getNewsletterById(id: string) {
    const newsletter = await this.prisma.newsletter.findUnique({
      where: { id },
    });
    if (!newsletter) {
      throw new Error('Newsletter not found');
    }
    return newsletter;
  }

  async broadcastNewsletter({ subject, html }: BroadcastNewsletterDto) {
    const subscribers = await this.prisma.newsletter.findMany({
      select: { email: true },
    });

    const mails = subscribers.map((subscriber) => ({
      to: subscriber.email,
      subject,
      html,
    }));

    await this.mailQueue.sendBulk(mails);

    return { queued: mails.length };
  }
}
