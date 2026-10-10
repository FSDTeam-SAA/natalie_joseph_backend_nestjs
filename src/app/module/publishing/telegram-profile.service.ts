import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Interval } from '@nestjs/schedule';
import axios from 'axios';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '../../../prisma/prisma.service';
import { botKeyForCompanion, botValue } from '../telegram/telegram-config';
import { TelegramProfileDto } from './publishing.dto';

@Injectable()
export class TelegramProfileService {
  private running = false;
  private readonly logger = new Logger(TelegramProfileService.name);
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  enabled() {
    return this.config.get('TELEGRAM_PROFILE_SYNC_ENABLED') === 'true';
  }

  // Only Cloudinary assets owned by this application may be downloaded server-side.
  jpegUrl(raw: string) {
    const cloud = this.config.get<string>('CLOUDINARY_CLOUD_NAME');
    const url = new URL(raw);
    const prefix = `/${cloud}/image/upload/`;
    if (
      !cloud ||
      url.protocol !== 'https:' ||
      url.hostname !== 'res.cloudinary.com' ||
      url.port ||
      url.username ||
      url.password ||
      !url.pathname.startsWith(prefix)
    )
      throw new BadRequestException(
        'Upload the profile image through this backend before syncing Telegram',
      );
    url.pathname = prefix + 'f_jpg/' + url.pathname.slice(prefix.length);
    url.search = '';
    url.hash = '';
    return url.toString();
  }

  async save(
    id: string,
    dto: TelegramProfileDto,
    photoUrl?: string,
    updateWebsiteName = true,
  ) {
    botKeyForCompanion(this.config, id);
    if (photoUrl) this.jpegUrl(photoUrl);
    const data = { ...dto, ...(photoUrl ? { photoUrl } : {}) };
    const saveSync = this.prisma.telegramProfileSync.upsert({
      where: { companionId: id },
      create: { companionId: id, ...data },
      update: {
        ...data,
        version: { increment: 1 },
        status: 'pending',
        attempts: 0,
        lastError: null,
        nextAttemptAt: new Date(),
      },
    });
    if (dto.displayName !== undefined && updateWebsiteName) {
      await this.prisma.$transaction([
        this.prisma.companions.update({
          where: { id },
          data: { name: dto.displayName },
        }),
        saveSync,
      ]);
    } else await saveSync;
    return this.status(id);
  }

  async automatic(id: string, name?: string, photoUrl?: string) {
    if (!this.enabled()) return;
    try {
      botKeyForCompanion(this.config, id);
    } catch {
      return;
    }
    try {
      return await this.save(
        id,
        name ? { displayName: name.slice(0, 64) } : {},
        photoUrl,
        false,
      );
    } catch {
      // The website save remains successful, but the API must surface the enqueue failure.
      this.logger.warn('Could not enqueue Telegram profile update');
      return {
        status: 'failed',
        lastError:
          'Website saved; Telegram sync could not be queued. Use the profile sync API to retry.',
      };
    }
  }

  async status(id: string) {
    const row = await this.prisma.telegramProfileSync.findUnique({
      where: { companionId: id },
    });
    if (!row) return { enabled: this.enabled(), status: 'not_configured' };
    const { leaseToken: _lease, lockedUntil: _lock, ...safe } = row;
    return { ...safe, enabled: this.enabled() };
  }

  async retry(id: string) {
    botKeyForCompanion(this.config, id);
    await this.prisma.telegramProfileSync.update({
      where: { companionId: id },
      data: {
        status: 'pending',
        attempts: 0,
        lastError: null,
        nextAttemptAt: new Date(),
      },
    });
    return this.status(id);
  }

  @Interval(15000)
  async tick() {
    if (!this.enabled() || this.running) return;
    this.running = true;
    try {
      const now = new Date();
      const rows = await this.prisma.telegramProfileSync.findMany({
        where: {
          status: { in: ['pending', 'processing'] },
          nextAttemptAt: { lte: now },
          OR: [{ lockedUntil: null }, { lockedUntil: { lte: now } }],
        },
        take: 5,
        orderBy: { updatedAt: 'asc' },
      });
      for (const row of rows) await this.sync(row);
    } catch {
      this.logger.warn(
        'Profile sync worker unavailable; check publishing migration and database',
      );
    } finally {
      this.running = false;
    }
  }

  async sync(row: {
    companionId: string;
    version: number;
    attempts: number;
    displayName: string | null;
    about: string | null;
    description: string | null;
    photoUrl: string | null;
  }) {
    const lease = randomUUID();
    const now = new Date();
    const claimed = await this.prisma.telegramProfileSync.updateMany({
      where: {
        companionId: row.companionId,
        version: row.version,
        OR: [{ lockedUntil: null }, { lockedUntil: { lte: now } }],
      },
      data: {
        leaseToken: lease,
        lockedUntil: new Date(Date.now() + 300000),
        status: 'processing',
      },
    });
    if (!claimed.count) return;
    try {
      const key = botKeyForCompanion(this.config, row.companionId);
      const token = botValue(this.config, key, 'BOT_TOKEN');
      const post = async (method: string, body: unknown) => {
        const result = await axios.post(
          `https://api.telegram.org/bot${token}/${method}`,
          body,
          { timeout: 20000, maxRedirects: 0 },
        );
        if (result.data?.ok !== true)
          throw new Error('Telegram rejected profile update');
      };
      if (row.displayName !== null)
        await post('setMyName', { name: row.displayName });
      if (row.about !== null)
        await post('setMyShortDescription', { short_description: row.about });
      if (row.description !== null)
        await post('setMyDescription', { description: row.description });
      if (row.photoUrl) {
        const result = await axios.get<ArrayBuffer>(
          this.jpegUrl(row.photoUrl),
          {
            responseType: 'arraybuffer',
            timeout: 20000,
            maxRedirects: 0,
            maxContentLength: 5 * 1024 * 1024,
          },
        );
        const bytes = Buffer.from(result.data);
        if (
          bytes.length < 3 ||
          bytes[0] !== 255 ||
          bytes[1] !== 216 ||
          bytes[2] !== 255
        )
          throw new Error('Invalid JPEG');
        const form = new FormData();
        form.append(
          'photo',
          JSON.stringify({ type: 'static', photo: 'attach://profile' }),
        );
        form.append(
          'profile',
          new Blob([new Uint8Array(bytes)], { type: 'image/jpeg' }),
          'profile.jpg',
        );
        await post('setMyProfilePhoto', form);
      }
      await this.prisma.telegramProfileSync.updateMany({
        where: {
          companionId: row.companionId,
          version: row.version,
          leaseToken: lease,
        },
        data: {
          status: 'synced',
          syncedVersion: row.version,
          syncedAt: new Date(),
          lastError: null,
        },
      });
    } catch (error) {
      const attempts = row.attempts + 1;
      const code = axios.isAxiosError(error)
        ? error.response?.status
        : undefined;
      const retryAfter = axios.isAxiosError(error)
        ? Number(error.response?.data?.parameters?.retry_after) || 0
        : 0;
      await this.prisma.telegramProfileSync.updateMany({
        where: {
          companionId: row.companionId,
          version: row.version,
          leaseToken: lease,
        },
        data: {
          status: attempts >= 3 ? 'failed' : 'pending',
          attempts,
          nextAttemptAt: new Date(
            Date.now() + Math.max(30 * attempts, retryAfter) * 1000,
          ),
          lastError: `Telegram profile update failed${code ? ` (HTTP ${code})` : ''}. Check bot configuration and uploaded image, then retry.`,
        },
      });
    } finally {
      // A save made while syncing stays pending and is processed next; never mark it synced.
      await this.prisma.telegramProfileSync.updateMany({
        where: { companionId: row.companionId, leaseToken: lease },
        data: { lockedUntil: null, leaseToken: null },
      });
    }
  }
}
