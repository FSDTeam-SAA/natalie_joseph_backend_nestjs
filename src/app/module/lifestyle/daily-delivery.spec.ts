import axios from 'axios';
import { ConfigService } from '@nestjs/config';
import { DailyDeliveryService } from './daily-delivery.service';
import { LifestyleService } from './lifestyle.service';
import { PrismaService } from '../../../prisma/prisma.service';

describe('Daily content delivery safety', () => {
  afterEach(() => {
    jest.restoreAllMocks();
    jest.useRealTimers();
  });
  function setup(existing = false, linked = true) {
    jest.useFakeTimers().setSystemTime(new Date('2026-10-24T08:00:00Z'));
    const content = {
      id: 'd',
      companionId: 'c',
      day: '2026-10-24',
      text: 'Good morning',
      photo: { url: 'https://example.test/photo.jpg', caption: 'Morning' },
    };
    const tx = {
      $queryRaw: jest.fn(),
      dailyDelivery: {
        findUnique: jest
          .fn()
          .mockResolvedValue(existing ? { id: 'old' } : null),
        create: jest
          .fn()
          .mockImplementation(({ data }) =>
            Promise.resolve({ id: 'delivery', ...data }),
          ),
        update: jest.fn(),
      },
      dailyContent: { findFirst: jest.fn().mockResolvedValue(content) },
      companionRoutine: {
        findUnique: jest.fn().mockResolvedValue({ timezone: 'Asia/Dubai' }),
      },
      dailyPreference: {
        findUnique: jest
          .fn()
          .mockResolvedValue({ enabled: true, companionId: 'c' }),
      },
      telegramConnection: {
        findUnique: jest
          .fn()
          .mockResolvedValue(linked ? { telegramId: '123' } : null),
      },
      photoView: { upsert: jest.fn() },
      notification: { create: jest.fn() },
    };
    const prisma = {
      ...tx,
      $transaction: async (fn: (arg: unknown) => unknown) => await fn(tx),
    };
    const lifestyle = {
      active: jest.fn().mockResolvedValue({
        id: 's',
        entitlementPolicy: {
          kind: 'paid',
          dailyPhoto: true,
          dailyText: true,
        },
      }),
      allowance: jest.fn(),
    };
    const config = new ConfigService({
      TELEGRAM_ELENA_COMPANION_ID: 'c',
      TELEGRAM_ELENA_BOT_TOKEN: 'test-token',
    });
    return {
      tx,
      content,
      lifestyle,
      service: new DailyDeliveryService(
        prisma as unknown as PrismaService,
        lifestyle as unknown as LifestyleService,
        config,
      ),
    };
  }
  it('never sends a reserved content item twice', async () => {
    const { service, lifestyle } = setup(true);
    const send = jest.spyOn(axios, 'post');
    await service.deliver('u', 'd', 'photo');
    expect(send).not.toHaveBeenCalled();
    expect(lifestyle.allowance).not.toHaveBeenCalled();
  });
  it('stores included website content even without a Telegram link', async () => {
    const { service, tx } = setup(false, false);
    const send = jest.spyOn(axios, 'post');
    await service.deliver('u', 'd', 'photo');
    expect(tx.dailyDelivery.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ status: 'available' }),
    });
    expect(send).not.toHaveBeenCalled();
    expect(tx.notification.create).toHaveBeenCalledTimes(1);
  });
  it('skips yesterday content instead of sending a backlog', async () => {
    const { service, content, lifestyle } = setup();
    content.day = '2026-10-23';
    await service.deliver('u', 'd', 'photo');
    expect(lifestyle.allowance).not.toHaveBeenCalled();
  });
  it('marks an ambiguous send unknown and does not retry it', async () => {
    const { service, tx } = setup();
    const send = jest
      .spyOn(axios, 'post')
      .mockRejectedValue(new Error('timeout'));
    await service.deliver('u', 'd', 'photo');
    expect(send).toHaveBeenCalledTimes(1);
    expect(tx.dailyDelivery.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'unknown' }),
      }),
    );
  });
});
