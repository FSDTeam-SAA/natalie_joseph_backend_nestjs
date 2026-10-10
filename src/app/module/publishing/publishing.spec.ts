import { Script } from 'node:vm';
/* eslint-disable @typescript-eslint/unbound-method -- Jest inspects mocked methods without invoking them. */
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import { MediaStoryService, storyMime } from './media-story.service';
import { TelegramProfileService } from './telegram-profile.service';
import { StoryMediaController } from './publishing.controller';
import { PrismaService } from '../../../prisma/prisma.service';
import { publishingConsole } from './publishing-console';
import { storyViewer } from './story-viewer';

jest.mock('axios');
const config = () =>
  new ConfigService({
    COMPANION_MEDIA_STORIES_ENABLED: 'true',
    TELEGRAM_PROFILE_SYNC_ENABLED: 'true',
    ACCESS_TOKEN_SECRET: 'a'.repeat(40),
    CLOUDINARY_CLOUD_NAME: 'test-cloud',
    TELEGRAM_ELENA_COMPANION_ID: 'companion',
    TELEGRAM_ELENA_BOT_TOKEN: '123:test',
    TELEGRAM_PUBLIC_BASE_URL: 'https://backend.example.com',
  });
const profileRow = {
  companionId: 'companion',
  version: 1,
  attempts: 0,
  displayName: 'Elena',
  about: 'Hello',
  description: 'Description',
  photoUrl: null,
};

describe('Companion publishing boundaries', () => {
  afterEach(() => jest.restoreAllMocks());
  it('detects actual media bytes and rejects SVG or fake MP4', () => {
    expect(storyMime(Buffer.from([255, 216, 255, 0]))).toBe('image/jpeg');
    expect(() => storyMime(Buffer.from('<svg onload="alert(1)"/>'))).toThrow();
    expect(() => storyMime(Buffer.from('not-an-mp4'))).toThrow();
  });
  it('sets exact 24-hour expiry and excludes media bytes from publish response', async () => {
    const create = jest.fn().mockResolvedValue({ id: 'story' });
    const db = {
      companions: {
        findFirst: jest.fn().mockResolvedValue({ id: 'companion' }),
      },
      companionMediaStory: { create },
    };
    const service = new MediaStoryService(
      db as unknown as PrismaService,
      config(),
    );
    await service.publish('companion', 'Hello', {
      buffer: Buffer.from([255, 216, 255, 0]),
    } as Express.Multer.File);
    const args = create.mock.calls[0][0];
    expect(
      args.data.expiresAt.getTime() - args.data.publishedAt.getTime(),
    ).toBe(86400000);
    expect(args.select.media).toBeUndefined();
  });
  it('rejects expired, tampered and cross-story media tickets', () => {
    const service = new MediaStoryService({} as PrismaService, config());
    const ticket = service.ticket(
      'story',
      'user',
      new Date(Date.now() + 60000),
    );
    expect(service.readTicket('story', ticket)).toBe('user');
    expect(() => service.readTicket('other', ticket)).toThrow();
    expect(() => service.readTicket('story', ticket + '1')).toThrow();
    const expired = service.ticket(
      'story',
      'user',
      new Date(Date.now() - 1000),
    );
    expect(() => service.readTicket('story', expired)).toThrow();
  });
  it('rechecks database expiry and active companion when fetching media', async () => {
    const findFirst = jest.fn().mockResolvedValue(null);
    const db = {
      user: {
        findUnique: jest.fn().mockResolvedValue({
          status: 'approved',
          adultEligible: true,
          role: 'user',
        }),
      },
      companionMediaStory: { findFirst },
    };
    const service = new MediaStoryService(
      db as unknown as PrismaService,
      config(),
    );
    const ticket = service.ticket(
      'story',
      'user',
      new Date(Date.now() + 60000),
    );
    await expect(service.media('story', ticket)).rejects.toThrow('expired');
    expect(findFirst.mock.calls[0][0].where).toMatchObject({
      deletedAt: null,
      expiresAt: { gt: expect.any(Date) },
      companion: { status: true },
    });
  });
  it('denies media after an account is blocked', async () => {
    const service = new MediaStoryService(
      {
        user: {
          findUnique: jest
            .fn()
            .mockResolvedValue({ status: 'blocked', adultEligible: true }),
        },
      } as unknown as PrismaService,
      config(),
    );
    await expect(
      service.media(
        'story',
        service.ticket('story', 'user', new Date(Date.now() + 60000)),
      ),
    ).rejects.toThrow('approved adult');
  });
  it('never lists expired/unpublished/deleted story bytes or unbounded records', async () => {
    const findMany = jest.fn().mockResolvedValue([]);
    const db = {
      user: {
        findUnique: jest
          .fn()
          .mockResolvedValue({ status: 'approved', adultEligible: true }),
      },
      companions: { findFirst: jest.fn().mockResolvedValue({ name: 'Elena' }) },
      companionMediaStory: { findMany },
    };
    const service = new MediaStoryService(
      db as unknown as PrismaService,
      config(),
    );
    expect((await service.list('companion', 'user')).hasActiveStory).toBe(
      false,
    );
    expect(findMany.mock.calls[0][0]).toMatchObject({
      take: 100,
      where: {
        deletedAt: null,
        expiresAt: { gt: expect.any(Date) },
        publishedAt: { lte: expect.any(Date) },
      },
    });
    expect(findMany.mock.calls[0][0].select.media).toBeUndefined();
  });
  it('restricts profile image download to this applications Cloudinary image uploads', () => {
    const service = new TelegramProfileService({} as PrismaService, config());
    expect(
      service.jpegUrl(
        'https://res.cloudinary.com/test-cloud/image/upload/v1/photo.png',
      ),
    ).toContain('/f_jpg/v1/photo.png');
    for (const url of [
      'http://127.0.0.1/private',
      'https://res.cloudinary.com/other/image/upload/x',
      'https://res.cloudinary.com.evil.test/test-cloud/image/upload/x',
      'https://res.cloudinary.com/test-cloud/image/upload/../../fetch/https://evil.test',
    ])
      expect(() => service.jpegUrl(url)).toThrow();
  });
  it('does not send a profile when another worker owns its lease', async () => {
    const updateMany = jest.fn().mockResolvedValue({ count: 0 });
    const service = new TelegramProfileService(
      { telegramProfileSync: { updateMany } } as unknown as PrismaService,
      config(),
    );
    jest.mocked(axios.post).mockClear();
    await service.sync(profileRow);
    expect(axios.post).not.toHaveBeenCalled();
  });
  it('guards completion with version and lease so a newer edit is not marked synced', async () => {
    const updateMany = jest.fn().mockResolvedValue({ count: 1 });
    jest.mocked(axios.post).mockResolvedValue({ data: { ok: true } });
    const service = new TelegramProfileService(
      { telegramProfileSync: { updateMany } } as unknown as PrismaService,
      config(),
    );
    await service.sync(profileRow);
    expect(updateMany.mock.calls[1][0]).toMatchObject({
      where: { version: 1, leaseToken: expect.any(String) },
      data: { status: 'synced', syncedVersion: 1 },
    });
    expect(updateMany.mock.calls[2][0].data).toEqual({
      lockedUntil: null,
      leaseToken: null,
    });
  });
  it('records a sanitized failure and stops automatic retries after three failures', async () => {
    const updateMany = jest.fn().mockResolvedValue({ count: 1 });
    jest
      .mocked(axios.post)
      .mockRejectedValue(new Error('https://api.telegram.org/botSECRET/token'));
    const service = new TelegramProfileService(
      { telegramProfileSync: { updateMany } } as unknown as PrismaService,
      config(),
    );
    await service.sync({ ...profileRow, attempts: 2 });
    expect(updateMany.mock.calls[1][0].data.status).toBe('failed');
    expect(JSON.stringify(updateMany.mock.calls)).not.toContain('SECRET');
  });
  it('handles video range requests and refuses invalid ranges', async () => {
    const service = {
      media: jest.fn().mockResolvedValue({
        media: Buffer.from('0123456789'),
        mimeType: 'video/mp4',
      }),
    };
    const controller = new StoryMediaController(
      service as unknown as MediaStoryService,
    );
    const res = {
      set: jest.fn().mockReturnThis(),
      status: jest.fn().mockReturnThis(),
      send: jest.fn().mockReturnThis(),
      end: jest.fn().mockReturnThis(),
    };
    await controller.media('story', 'ticket', 'bytes=2-4', res as never);
    expect(res.status).toHaveBeenCalledWith(206);
    expect(res.send).toHaveBeenCalledWith(Buffer.from('234'));
    await controller.media('story', 'ticket', 'bytes=30-', res as never);
    expect(res.status).toHaveBeenCalledWith(416);
  });
  it('ships parseable browser scripts with no stored credentials', () => {
    for (const page of [publishingConsole, storyViewer]) {
      for (const match of page.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/gi))
        if (match[1]) expect(() => new Script(match[1])).not.toThrow();
      expect(page).not.toMatch(/localStorage|sessionStorage/);
    }
  });
});
