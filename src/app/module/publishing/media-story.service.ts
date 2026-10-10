import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Interval } from '@nestjs/schedule';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { PrismaService } from '../../../prisma/prisma.service';
import {
  botKeyForCompanion,
  botValue,
  miniAppUrl,
} from '../telegram/telegram-config';
import { verifyTelegramInitData } from '../telegram/telegram-mini-app.service';

const metadata = {
  id: true,
  companionId: true,
  caption: true,
  mimeType: true,
  publishedAt: true,
  expiresAt: true,
  deletedAt: true,
} as const;

export function storyMime(bytes: Buffer) {
  if (
    bytes.length >= 3 &&
    bytes[0] === 255 &&
    bytes[1] === 216 &&
    bytes[2] === 255
  )
    return 'image/jpeg';
  if (
    bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
  )
    return 'image/png';
  if (
    bytes.length > 12 &&
    bytes.toString('ascii', 0, 4) === 'RIFF' &&
    bytes.toString('ascii', 8, 12) === 'WEBP'
  )
    return 'image/webp';
  if (
    bytes.length > 12 &&
    bytes.toString('ascii', 4, 8) === 'ftyp' &&
    /^(isom|iso2|mp41|mp42|avc1|M4V )$/.test(bytes.toString('ascii', 8, 12))
  )
    return 'video/mp4';
  throw new BadRequestException('Use a JPEG, PNG, WebP image or MP4 video');
}

@Injectable()
export class MediaStoryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}
  enabled() {
    return this.config.get('COMPANION_MEDIA_STORIES_ENABLED') === 'true';
  }
  private requireEnabled() {
    if (!this.enabled())
      throw new ServiceUnavailableException('Stories are not enabled');
  }
  async companion(id: string) {
    const companion = await this.prisma.companions.findFirst({
      where: { id, status: true },
      select: { id: true, name: true, profileImage: true },
    });
    if (!companion) throw new NotFoundException('Active companion not found');
    return companion;
  }
  private async eligible(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { status: true, adultEligible: true, role: true },
    });
    if (
      !user ||
      user.status !== 'approved' ||
      (!user.adultEligible && user.role !== 'admin')
    )
      throw new ForbiddenException('An approved adult account is required');
  }
  async telegramUser(id: string, initData: string) {
    const key = botKeyForCompanion(this.config, id);
    const telegramId = verifyTelegramInitData(
      initData,
      botValue(this.config, key, 'BOT_TOKEN'),
    );
    const link = await this.prisma.telegramConnection.findUnique({
      where: { telegramId_companionId: { telegramId, companionId: id } },
      select: { userId: true },
    });
    if (!link)
      throw new ForbiddenException(
        'Connect your Meet Elysia account using /login first',
      );
    await this.eligible(link.userId);
    return link.userId;
  }
  async publish(id: string, caption: string, file?: Express.Multer.File) {
    this.requireEnabled();
    await this.companion(id);
    const limit =
      Math.max(
        1,
        Math.min(20, Number(this.config.get('STORY_MAX_UPLOAD_MB')) || 10),
      ) *
      1024 *
      1024;
    if (!file?.buffer.length || file.buffer.length > limit)
      throw new BadRequestException(
        `Upload media up to ${limit / 1024 / 1024} MB`,
      );
    const mimeType = storyMime(file.buffer);
    const publishedAt = new Date();
    return this.prisma.companionMediaStory.create({
      data: {
        companionId: id,
        caption,
        mimeType,
        media: new Uint8Array(file.buffer),
        publishedAt,
        expiresAt: new Date(publishedAt.getTime() + 86400000),
      },
      select: metadata,
    });
  }
  adminList(id: string) {
    return this.prisma.companionMediaStory.findMany({
      where: { companionId: id },
      select: metadata,
      orderBy: { publishedAt: 'desc' },
      take: 100,
    });
  }
  async remove(id: string, storyId: string) {
    const changed = await this.prisma.companionMediaStory.updateMany({
      where: { id: storyId, companionId: id, deletedAt: null },
      data: { deletedAt: new Date(), media: new Uint8Array() },
    });
    if (!changed.count) throw new NotFoundException('Story not found');
    return { deleted: true };
  }
  private secret() {
    const secret =
      this.config.get<string>('STORY_MEDIA_SIGNING_SECRET') ||
      this.config.get<string>('ACCESS_TOKEN_SECRET');
    if (!secret)
      throw new ServiceUnavailableException(
        'Story media signing is not configured',
      );
    return secret;
  }
  ticket(id: string, userId: string, expiresAt: Date) {
    const expiry = Math.min(
      Math.floor(expiresAt.getTime() / 1000),
      Math.floor(Date.now() / 1000) + 300,
    );
    const payload = Buffer.from(
      JSON.stringify({ id, userId, expiry }),
    ).toString('base64url');
    return (
      payload +
      '.' +
      createHmac('sha256', this.secret()).update(payload).digest('hex')
    );
  }
  readTicket(id: string, ticket: string) {
    if (ticket.length > 2048)
      throw new ForbiddenException('Invalid media link');
    const [payload, signature, ...extra] = ticket.split('.');
    const expected = createHmac('sha256', this.secret())
      .update(payload || '')
      .digest();
    if (
      extra.length ||
      !/^[a-f0-9]{64}$/.test(signature || '') ||
      !timingSafeEqual(expected, Buffer.from(signature, 'hex'))
    )
      throw new ForbiddenException('Invalid media link');
    let value: { id: string; userId: string; expiry: number };
    try {
      value = JSON.parse(
        Buffer.from(payload, 'base64url').toString(),
      ) as typeof value;
    } catch {
      throw new ForbiddenException('Invalid media link');
    }
    if (
      value.id !== id ||
      !value.userId ||
      !Number.isFinite(value.expiry) ||
      value.expiry <= Date.now() / 1000
    )
      throw new ForbiddenException('Media link expired; refresh stories');
    return value.userId;
  }
  async list(id: string, userId: string) {
    this.requireEnabled();
    await this.eligible(userId);
    const companion = await this.companion(id);
    const now = new Date();
    const stories = await this.prisma.companionMediaStory.findMany({
      where: {
        companionId: id,
        deletedAt: null,
        publishedAt: { lte: now },
        expiresAt: { gt: now },
      },
      select: metadata,
      orderBy: { publishedAt: 'asc' },
      take: 100,
    });
    return {
      companion,
      serverTime: now,
      hasActiveStory: stories.length > 0,
      stories: stories.map((s) => ({
        ...s,
        mediaPath: `/api/v1/media-stories/${s.id}/media?ticket=${this.ticket(s.id, userId, s.expiresAt)}`,
      })),
    };
  }
  async summary(userId: string) {
    this.requireEnabled();
    await this.eligible(userId);
    const now = new Date();
    const rows = await this.prisma.companionMediaStory.groupBy({
      by: ['companionId'],
      where: {
        deletedAt: null,
        expiresAt: { gt: now },
        publishedAt: { lte: now },
        companion: { status: true },
      },
      _count: { id: true },
      _max: { publishedAt: true, expiresAt: true },
    });
    return rows.map((r) => ({
      companionId: r.companionId,
      count: r._count.id,
      latestPublishedAt: r._max.publishedAt,
      expiresAt: r._max.expiresAt,
    }));
  }
  async media(id: string, ticket: string) {
    this.requireEnabled();
    const userId = this.readTicket(id, ticket);
    await this.eligible(userId);
    const row = await this.prisma.companionMediaStory.findFirst({
      where: {
        id,
        deletedAt: null,
        publishedAt: { lte: new Date() },
        expiresAt: { gt: new Date() },
        companion: { status: true },
      },
    });
    if (!row) throw new NotFoundException('Story expired or unavailable');
    return row;
  }
  viewerUrl(companionId: string) {
    const url = new URL(miniAppUrl(this.config, companionId));
    url.pathname = '/api/v1/telegram/stories';
    return url.toString();
  }
  @Interval(600000)
  async purge() {
    if (!this.enabled()) return;
    // Expiry access checks do not depend on this cleanup succeeding or running on time.
    try {
      await this.prisma
        .$executeRaw`UPDATE companion_media_stories SET media = ''::bytea WHERE "expiresAt" <= NOW() AND octet_length(media) > 0`;
    } catch {
      /* Deployment may be waiting for migration. No user payloads logged. */
    }
  }
}
