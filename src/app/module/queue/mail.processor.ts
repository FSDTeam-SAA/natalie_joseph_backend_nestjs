import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import sendMailer from '../../helper/sendMailer';
import { MAIL_QUEUE, SEND_MAIL_JOB } from './mail-queue.constants';
import { QueuedMail } from './mail-queue.types';

@Processor(MAIL_QUEUE)
export class MailProcessor extends WorkerHost {
  async process(job: Job<QueuedMail>): Promise<void> {
    if (job.name !== SEND_MAIL_JOB) {
      throw new Error(`Unknown mail job: ${job.name}`);
    }

    await sendMailer(job.data.to, job.data.subject, job.data.html);
  }
}
