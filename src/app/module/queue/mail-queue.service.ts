import { InjectQueue } from '@nestjs/bullmq';
import { Injectable } from '@nestjs/common';
import { JobsOptions, Queue } from 'bullmq';
import { MAIL_QUEUE, SEND_MAIL_JOB } from './mail-queue.constants';
import { QueuedMail } from './mail-queue.types';

const defaultJobOptions: JobsOptions = {
  attempts: 3,
  backoff: {
    type: 'exponential',
    delay: 3000,
  },
  removeOnComplete: true,
  removeOnFail: 1000,
};

@Injectable()
export class MailQueueService {
  constructor(@InjectQueue(MAIL_QUEUE) private readonly mailQueue: Queue) {}

  async sendMail(mail: QueuedMail, options: JobsOptions = {}) {
    return this.mailQueue.add(SEND_MAIL_JOB, mail, {
      ...defaultJobOptions,
      ...options,
    });
  }

  async sendBulk(mails: QueuedMail[]) {
    if (mails.length === 0) return [];

    return this.mailQueue.addBulk(
      mails.map((data) => ({
        name: SEND_MAIL_JOB,
        data,
        opts: defaultJobOptions,
      })),
    );
  }
}
