import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Interval } from '@nestjs/schedule';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '../../../prisma/prisma.service';
import { TelegramService } from './telegram.service';
import { BotKey, botKeys } from './telegram-config';
import { TelegramDeliveryFailure } from './telegram-http';

type Job = {
  id: string;
  bot: BotKey;
  payload: unknown;
  attempts: number;
  leaseToken: string;
};

@Injectable()
export class TelegramQueueService {
  private readonly logger = new Logger(TelegramQueueService.name);
  private active = 0;
  constructor(
    private readonly prisma: PrismaService,
    private readonly telegram: TelegramService,
    private readonly config: ConfigService,
  ) {}

  async receive(body: unknown, key: BotKey = 'ELENA') {
    if (this.config.get('TELEGRAM_QUEUE_ENABLED') !== 'true')
      return this.telegram.receive(body, key);
    if (this.config.get('TELEGRAM_AUTO_REPLY_ENABLED') !== 'true') return;
    const update = body as {
      update_id?: number;
      message?: {
        text?: string;
        voice?: { file_id?: string };
        audio?: { file_id?: string };
        from?: { is_bot?: boolean };
        chat?: { id?: number; type?: string };
      };
    } | null;
    if (
      !Number.isSafeInteger(update?.update_id) ||
      !Number.isSafeInteger(update?.message?.chat?.id) ||
      update?.message?.chat?.type !== 'private' ||
      update?.message?.from?.is_bot
    )
      return;
    if (
      typeof update.message.text !== 'string' &&
      typeof (update.message.voice || update.message.audio)?.file_id !==
        'string'
    )
      return;
    // Keep only the fields needed for delivery, not the user's profile or unrelated update metadata.
    const message = update.message;
    const payload = JSON.stringify({
      update_id: update.update_id,
      message: {
        text: message.text,
        voice: message.voice,
        audio: message.audio,
        chat: message.chat,
        from: { is_bot: false },
      },
    });
    const id = `${key}:${update.update_id}`;
    await this.prisma
      .$executeRaw`INSERT INTO telegram_jobs (id, bot, "chatId", payload)
      VALUES (${id}, ${key}, ${String(message.chat!.id)}, ${payload}::jsonb) ON CONFLICT (id) DO NOTHING`;
    // Acknowledge only after durable storage; never acknowledge a database failure.
  }

  @Interval(1000)
  async drain() {
    const configured = Number(
      this.config.get('TELEGRAM_WORKER_CONCURRENCY') || 2,
    );
    const concurrency =
      Number.isInteger(configured) && configured >= 1 && configured <= 8
        ? configured
        : 2;
    if (
      this.active >= concurrency ||
      this.config.get('TELEGRAM_QUEUE_ENABLED') !== 'true' ||
      this.config.get('TELEGRAM_AUTO_REPLY_ENABLED') !== 'true'
    )
      return;
    this.active++;
    try {
      const jobs = await this.prisma.$transaction(async (tx) => {
        // Short global claim lock prevents two replicas claiming different jobs for one chat.
        await tx.$queryRaw`SELECT pg_advisory_xact_lock(193811, 1)`;
        await tx.$executeRaw`UPDATE telegram_jobs SET status = CASE WHEN attempts >= 5 THEN 'failed' ELSE 'pending' END,
          "leaseUntil" = NULL, "leaseToken" = NULL, "updatedAt" = NOW()
          WHERE status = 'processing' AND "leaseUntil" < NOW()`;
        const rows = await tx.$queryRaw<
          { id: string }[]
        >`SELECT j.id FROM telegram_jobs j
          WHERE j.status = 'pending' AND j."availableAt" <= NOW()
          AND NOT EXISTS (SELECT 1 FROM telegram_jobs p WHERE p.bot=j.bot AND p."chatId"=j."chatId" AND p.status='processing')
          AND NOT EXISTS (SELECT 1 FROM telegram_jobs p WHERE p.bot=j.bot AND p."chatId"=j."chatId" AND p.status='pending' AND (p."createdAt",p.id) < (j."createdAt",j.id))
          ORDER BY j."createdAt", j.id LIMIT 1 FOR UPDATE SKIP LOCKED`;
        if (!rows.length) return [] as Job[];
        const leaseToken = randomUUID();
        return tx.$queryRaw<
          Job[]
        >`UPDATE telegram_jobs SET status='processing', attempts=attempts+1,
          "leaseUntil"=NOW()+INTERVAL '15 minutes', "leaseToken"=${leaseToken}, "updatedAt"=NOW()
          WHERE id=${rows[0].id} RETURNING id,bot,payload,attempts,"leaseToken"`;
      });
      for (const job of jobs) {
        try {
          if (!botKeys.includes(job.bot)) throw new Error('Unknown bot');
          await this.telegram.receive(job.payload, job.bot);
          await this.prisma
            .$executeRaw`UPDATE telegram_jobs SET status='completed',payload='{}'::jsonb,"leaseUntil"=NULL,"updatedAt"=NOW()
            WHERE id=${job.id} AND "leaseToken"=${job.leaseToken}`;
        } catch (error) {
          const delay = Math.max(
            Math.min(300, 5 * 2 ** job.attempts),
            error instanceof TelegramDeliveryFailure
              ? error.retryAfterSeconds
              : 0,
          );
          await this.prisma
            .$executeRaw`UPDATE telegram_jobs SET status=${job.attempts >= 5 ? 'failed' : 'pending'},
            "availableAt"=NOW()+${delay} * INTERVAL '1 second',"leaseUntil"=NULL,"updatedAt"=NOW()
            WHERE id=${job.id} AND "leaseToken"=${job.leaseToken}`;
          this.logger.warn(
            `Telegram job ${job.id} ${job.attempts >= 5 ? 'failed; operator review required' : 'scheduled for retry'}`,
          );
        }
      }
    } catch {
      this.logger.error(
        'Telegram queue unavailable; check database and migration status',
      );
    } finally {
      this.active--;
    }
  }

  @Interval(3600000)
  async cleanup() {
    try {
      await this.prisma
        .$executeRaw`DELETE FROM request_limits WHERE "expiresAt" < NOW()`;
      await this.prisma
        .$executeRaw`DELETE FROM telegram_jobs WHERE status IN ('completed','failed') AND "updatedAt" < NOW()-INTERVAL '7 days'`;
    } catch {
      this.logger.warn('Runtime retention cleanup failed');
    }
  }
}
