import {
  BadRequestException,
  ForbiddenException,
  HttpException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import {
  Prisma,
  LibraryPhoto,
} from '../../../../prisma/generated/prisma/client';
import { fileUpload } from '../../helper/fileUploder';
import { storyMime } from '../publishing/media-story.service';
import { CreditService } from '../credit/credit.service';
import {
  DailyContentDto,
  DailyPreferenceDto,
  LibraryPhotoDto,
  PhotoRequestDto,
  RoutineDto,
  RoutineSlotDto,
} from './lifestyle.dto';
import {
  currentSlot,
  localClock,
  policy,
  trialDay,
  validateRoutine,
} from './lifestyle-policy';

@Injectable()
export class LifestyleService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly credits: CreditService,
  ) {}
  async companion(id: string) {
    const row = await this.prisma.companions.findFirst({
      where: { id, status: true },
      select: { id: true, name: true },
    });
    if (!row) throw new NotFoundException('Active companion not found');
    return row;
  }
  async routine(id: string) {
    await this.companion(id);
    return this.prisma.companionRoutine.findUnique({
      where: { companionId: id },
    });
  }
  async saveRoutine(id: string, dto: RoutineDto) {
    await this.companion(id);
    validateRoutine(dto.timezone, dto.weekly);
    const data = {
      timezone: dto.timezone,
      weekly: JSON.parse(JSON.stringify(dto.weekly)) as Prisma.InputJsonValue,
    };
    return this.prisma.companionRoutine.upsert({
      where: { companionId: id },
      create: { companionId: id, ...data },
      update: data,
    });
  }
  async context(
    id: string,
    tx: Prisma.TransactionClient = this.prisma,
    at = new Date(),
  ) {
    const routine = await tx.companionRoutine.findUnique({
      where: { companionId: id },
    });
    const timezone = routine?.timezone || 'Asia/Dubai';
    const clock = localClock(timezone, at);
    const event = await tx.storyEvent.findUnique({
      where: {
        companionId_day: {
          companionId: id,
          day: new Date(clock.day + 'T00:00:00Z'),
        },
      },
    });
    const daily = await tx.dailyContent.findFirst({
      where: {
        companionId: id,
        day: clock.day,
        published: true,
        publishAt: { lte: at },
        expiresAt: { gt: at },
      },
      select: { activity: true, text: true, photoId: true },
    });
    const recentEvents = await tx.storyEvent.findMany({
      where: {
        companionId: id,
        published: true,
        day: { lt: new Date(clock.day + 'T00:00:00Z') },
      },
      orderBy: { day: 'desc' },
      take: 7,
      select: { day: true, title: true, content: true },
    });
    return {
      timezone,
      localDate: clock.day,
      localTime: clock.time,
      currentActivity: currentSlot(
        (routine?.weekly || []) as unknown as RoutineSlotDto[],
        clock.weekday,
        clock.minute,
      ),
      todayEvent: event?.published
        ? { title: event.title, content: event.content }
        : null,
      recentEvents,
      dailyContent: daily,
      instructions:
        'Use this approved context as grounding, not a script. Scheduled activities are plans, not evidence of completed actions. Do not invent social posts or private user memories.',
    };
  }
  async upload(id: string, dto: LibraryPhotoDto, file?: Express.Multer.File) {
    await this.companion(id);
    if (!file?.buffer.length || file.buffer.length > 10 * 1024 * 1024)
      throw new BadRequestException(
        'Upload an image up to 10 MB in the image field',
      );
    const mimeType = storyMime(file.buffer);
    if (!mimeType.startsWith('image/'))
      throw new BadRequestException(
        'Only JPEG, PNG or WebP images are allowed',
      );
    const tags = [
      ...new Set(
        dto.tags
          .split(',')
          .map((t) => t.trim().toLowerCase())
          .filter(Boolean),
      ),
    ];
    if (tags.length > 20 || tags.some((t) => t.length > 80))
      throw new BadRequestException(
        'Use up to 20 tags, at most 80 characters each',
      );
    const asset = await fileUpload.uploadToCloudinary(file);
    try {
      return await this.prisma.libraryPhoto.create({
        data: {
          companionId: id,
          url: asset.url,
          publicId: asset.public_id,
          mimeType,
          caption: dto.caption,
          tags,
        },
      });
    } catch (error) {
      await fileUpload.deleteFromCloudinary(asset.public_id);
      throw error;
    }
  }
  async photos(id: string, page: number) {
    await this.companion(id);
    return this.prisma.libraryPhoto.findMany({
      where: { companionId: id },
      orderBy: { createdAt: 'desc' },
      take: 50,
      skip: (page - 1) * 50,
    });
  }
  async approve(id: string, photoId: string, approved: boolean) {
    const result = await this.prisma.libraryPhoto.updateMany({
      where: { id: photoId, companionId: id },
      data: { approved },
    });
    if (!result.count) throw new NotFoundException('Photo not found');
    return { approved };
  }
  async saveDaily(id: string, dto: DailyContentDto) {
    await this.companion(id);
    const routine = await this.routine(id);
    const at = new Date(dto.publishAt),
      until = new Date(dto.expiresAt);
    if (
      localClock(routine?.timezone || 'Asia/Dubai', at).day !== dto.day ||
      until <= at ||
      until.getTime() - at.getTime() > 86400000
    )
      throw new BadRequestException(
        'Publish date must match companion local day; window must be positive and at most 24 hours',
      );
    const photo = await this.prisma.libraryPhoto.findFirst({
      where: { id: dto.photoId, companionId: id, approved: true },
    });
    if (!photo)
      throw new BadRequestException(
        'Choose an approved photo belonging to this companion',
      );
    return this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM companions WHERE id = ${id} FOR UPDATE`;
      const old = await tx.dailyContent.findUnique({
        where: { companionId_day: { companionId: id, day: dto.day } },
      });
      if (
        old &&
        (await tx.dailyDelivery.count({ where: { contentId: old.id } }))
      )
        throw new BadRequestException(
          'Content with delivery records is immutable; unpublish it to stop further deliveries',
        );
      const data = { ...dto, publishAt: at, expiresAt: until };
      return tx.dailyContent.upsert({
        where: { companionId_day: { companionId: id, day: dto.day } },
        create: { companionId: id, ...data },
        update: data,
      });
    });
  }
  async daily(id: string, page: number) {
    return this.prisma.dailyContent.findMany({
      where: { companionId: id },
      include: { photo: true },
      orderBy: { publishAt: 'desc' },
      take: 50,
      skip: (page - 1) * 50,
    });
  }
  async unpublish(id: string, contentId: string) {
    const r = await this.prisma.dailyContent.updateMany({
      where: { id: contentId, companionId: id },
      data: { published: false },
    });
    if (!r.count) throw new NotFoundException();
    return { published: false };
  }
  async preference(userId: string, dto?: DailyPreferenceDto) {
    if (!dto)
      return this.prisma.dailyPreference.findUnique({ where: { userId } });
    await this.companion(dto.companionId);
    return this.prisma.dailyPreference.upsert({
      where: { userId },
      create: { userId, ...dto },
      update: dto,
    });
  }
  async active(tx: Prisma.TransactionClient, userId: string) {
    const user = await tx.user.findUnique({
      where: { id: userId },
      select: { status: true, adultEligible: true },
    });
    if (user?.status !== 'approved' || user.adultEligible !== true)
      throw new ForbiddenException('An approved adult account is required');
    const s = await tx.userSubscription.findFirst({
      where: {
        userId,
        isActive: true,
        startsAt: { lte: new Date() },
        endsAt: { gt: new Date() },
      },
      orderBy: { endsAt: 'desc' },
    });
    if (!s) throw new HttpException('Active subscription required', 402);
    return s;
  }
  // Caller must hold the user's wallet lock. UTC days for paid plans; rolling 24h days for trial.
  async allowance(
    tx: Prisma.TransactionClient,
    s: { id: string; startsAt: Date; entitlementPolicy: unknown },
    action: 'trial_reply' | 'included_photo' | 'included_text',
  ) {
    const p = policy(s.entitlementPolicy),
      isTrial = p.kind === 'trial';
    const day = isTrial
      ? trialDay(s.startsAt)
      : new Date().toISOString().slice(0, 10);
    if (isTrial && Number(day.slice(6)) >= 3)
      throw new HttpException('Trial expired', 402);
    if (!isTrial && action === 'trial_reply') throw new BadRequestException();
    if (action === 'included_photo' && !isTrial && !p.dailyPhoto)
      throw new HttpException('Daily photo is not included in this plan', 402);
    if (action === 'included_text' && (isTrial || !p.dailyText))
      throw new HttpException('Daily text is not included in this plan', 402);
    const limit = action === 'trial_reply' ? p.trialRepliesPerDay : 1;
    const where = {
      subscriptionId_day_action: { subscriptionId: s.id, day, action },
    };
    const current = await tx.allowanceUsage.findUnique({ where });
    if ((current?.count || 0) >= limit)
      throw new HttpException('Daily allowance reached', 429);
    if (isTrial) {
      const total = await tx.allowanceUsage.aggregate({
        where: { subscriptionId: s.id, action },
        _sum: { count: true },
      });
      if (
        (total._sum.count || 0) >=
        (action === 'trial_reply' ? p.trialRepliesTotal : p.trialPhotosTotal)
      )
        throw new HttpException('Trial allowance reached', 402);
    }
    return tx.allowanceUsage.upsert({
      where,
      create: { subscriptionId: s.id, day, action, count: 1 },
      update: { count: { increment: 1 } },
    });
  }
  async requestPhoto(userId: string, id: string, dto: PhotoRequestDto) {
    await this.companion(id);
    return this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM users WHERE id = ${userId} FOR UPDATE`;
      const subscription = await this.active(tx, userId);
      const key = `library:${userId}:${id}:${dto.requestId}`;
      const previous = await tx.chatMessage.findUnique({
        where: { whatsappMessageKey: key },
      });
      if (previous) return previous;
      const tag = dto.tag?.trim().toLowerCase() || null;
      const [photo] = await tx.$queryRaw<LibraryPhoto[]>`
        SELECT p.* FROM library_photos p
        WHERE p."companionId"=${id} AND p.approved=true
          AND (${tag}::text IS NULL OR ${tag}=ANY(p.tags))
          AND NOT EXISTS (SELECT 1 FROM photo_views v WHERE v."userId"=${userId} AND v."companionId"=${id} AND v."photoUrl"=p.url)
        ORDER BY p."createdAt" ASC, p.id ASC LIMIT 1`;
      if (!photo)
        throw new NotFoundException(
          'No unseen approved photo matches. Choose another tag or request a custom AI image.',
        );
      const isTrial = policy(subscription.entitlementPolicy).kind === 'trial';
      const cost = isTrial ? 0 : (await this.credits.getCosts(tx)).photo;
      if (isTrial) await this.allowance(tx, subscription, 'included_photo');
      else if (
        !(await this.credits.consumeCredits(tx, userId, cost, {
          reason: 'photo',
          companionId: id,
          referenceId: key,
        }))
      )
        throw new HttpException('Insufficient credits', 402);
      await tx.photoView.upsert({
        where: {
          userId_companionId_photoUrl: {
            userId,
            companionId: id,
            photoUrl: photo.url,
          },
        },
        create: {
          userId,
          companionId: id,
          photoUrl: photo.url,
          creditCost: cost,
        },
        update: { viewCount: { increment: 1 }, lastViewedAt: new Date() },
      });
      return tx.chatMessage.create({
        data: {
          userId,
          companionId: id,
          whatsappMessageKey: key,
          message: '[Library photo request]',
          response: photo.caption || 'A moment from my day.',
          creditCost: cost,
          aiPayload: {
            message_type: 'image',
            media: {
              id: photo.id,
              kind: 'image',
              url: photo.url,
              mime_type: photo.mimeType,
              byte_size: 0,
            },
          },
        },
      });
    });
  }
  async usage(userId: string) {
    const s = await this.active(this.prisma, userId);
    return {
      subscriptionId: s.id,
      policy: policy(s.entitlementPolicy),
      periodStart: s.startsAt,
      periodEnd: s.endsAt,
      usage: await this.prisma.allowanceUsage.findMany({
        where: { subscriptionId: s.id },
        orderBy: { day: 'desc' },
        take: 100,
      }),
    };
  }
}
