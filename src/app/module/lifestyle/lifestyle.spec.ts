import { HttpException } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { Prisma } from '../../../../prisma/generated/prisma/client';
import { CreditService } from '../credit/credit.service';
import { LifestyleService } from './lifestyle.service';
import {
  currentSlot,
  localClock,
  trialDay,
  validateRoutine,
} from './lifestyle-policy';
import { responseCost } from '../chat/response-cost';
import type { AiReply } from '../../helper/ai/aiapi';
import { grantSubscriptionCredits } from '../credit/credit-ledger';

describe('Companion lifestyle and entitlement rules', () => {
  afterEach(() => jest.useRealTimers());
  it('resolves Dubai local date, not server timezone', () => {
    expect(
      localClock('Asia/Dubai', new Date('2026-10-25T22:30:00Z')),
    ).toMatchObject({ day: '2026-10-26', weekday: 1, time: '02:30' });
  });
  it('carries Sunday sleep into Monday and detects overnight overlap', () => {
    const sleep = { day: 7, start: '23:00', end: '06:00', activity: 'Sleep' };
    expect(currentSlot([sleep], 1, 120)).toEqual(sleep);
    expect(currentSlot([sleep], 1, 360)).toBeNull();
    expect(() =>
      validateRoutine('Asia/Dubai', [
        sleep,
        { day: 1, start: '05:00', end: '08:00', activity: 'Gym' },
      ]),
    ).toThrow('overlap');
    expect(() =>
      validateRoutine('Asia/Dubai', [
        sleep,
        { day: 1, start: '06:00', end: '08:00', activity: 'Gym' },
      ]),
    ).not.toThrow();
    expect(() => validateRoutine('bad/timezone', [])).toThrow('timezone');
  });
  it('uses elapsed 24h trial days rather than midnight resets', () => {
    expect(
      trialDay(
        new Date('2026-10-24T23:00:00Z'),
        new Date('2026-10-25T00:00:00Z'),
      ),
    ).toBe('trial-0');
    expect(
      trialDay(
        new Date('2026-10-24T23:00:00Z'),
        new Date('2026-10-25T23:00:00Z'),
      ),
    ).toBe('trial-1');
  });
  const costs = { message: 1, photo: 10, voice: 5, transcription: 1 };
  const reply = (fields: Partial<AiReply>) =>
    ({ response: 'hello', ...fields }) as AiReply;
  it('charges actual output plus transcription units without charging image captions separately', () => {
    expect(responseCost(reply({ message_type: 'image' }), false, costs)).toBe(
      10,
    );
    expect(
      responseCost(
        reply({
          message_type: 'audio',
          billing: { voice_characters: 501, transcription_seconds: 61 },
        }),
        true,
        costs,
      ),
    ).toBe(12);
    expect(
      responseCost(
        reply({ message_type: 'text', billing: { transcription_seconds: 60 } }),
        true,
        costs,
      ),
    ).toBe(2);
    expect(() =>
      responseCost(reply({ message_type: 'audio' }), false, costs),
    ).toThrow('metadata');
    expect(() =>
      responseCost(
        reply({ billing: { transcription_seconds: -1 } }),
        true,
        costs,
      ),
    ).toThrow('metadata');
  });
  function quota(daily = 0, total = 0) {
    const tx = {
      allowanceUsage: {
        findUnique: jest.fn().mockResolvedValue({ count: daily }),
        aggregate: jest.fn().mockResolvedValue({ _sum: { count: total } }),
        upsert: jest.fn().mockResolvedValue({ count: 1 }),
      },
    };
    const service = new LifestyleService(
      {} as PrismaService,
      {} as CreditService,
    );
    const subscription = {
      id: 's',
      startsAt: new Date('2026-10-24T00:00:00Z'),
      entitlementPolicy: { kind: 'trial' },
    };
    return {
      tx,
      service,
      subscription,
      client: tx as unknown as Prisma.TransactionClient,
    };
  }
  it('rejects the eleventh trial reply without writing another usage', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-10-24T05:00:00Z'));
    const { tx, service, subscription, client } = quota(10, 10);
    await expect(
      service.allowance(client, subscription, 'trial_reply'),
    ).rejects.toMatchObject({ status: 429 });
    expect(tx.allowanceUsage.upsert).not.toHaveBeenCalled();
  });
  it('caps total trial photos and expires trial at exactly 72 hours', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-10-26T05:00:00Z'));
    const { tx, service, subscription, client } = quota(0, 3);
    await expect(
      service.allowance(client, subscription, 'included_photo'),
    ).rejects.toThrow('Trial allowance');
    jest.setSystemTime(new Date('2026-10-27T00:00:00Z'));
    await expect(
      service.allowance(client, subscription, 'trial_reply'),
    ).rejects.toThrow('expired');
    expect(tx.allowanceUsage.upsert).not.toHaveBeenCalled();
  });
  it('does not give daily content to a legacy plan implicitly', async () => {
    const { service, subscription, client } = quota();
    subscription.entitlementPolicy = { kind: 'paid' };
    await expect(
      service.allowance(client, subscription, 'included_photo'),
    ).rejects.toBeInstanceOf(HttpException);
  });
  it('replays a library request without another debit or another image', async () => {
    const saved = { id: 'saved' };
    const tx = {
      $queryRaw: jest.fn(),
      user: {
        findUnique: jest
          .fn()
          .mockResolvedValue({ status: 'approved', adultEligible: true }),
      },
      userSubscription: { findFirst: jest.fn().mockResolvedValue({ id: 's' }) },
      chatMessage: { findUnique: jest.fn().mockResolvedValue(saved) },
    };
    const prisma = {
      companions: { findFirst: jest.fn().mockResolvedValue({ id: 'c' }) },
      $transaction: async (fn: (arg: unknown) => unknown) => await fn(tx),
    };
    const credits = { consumeCredits: jest.fn() };
    const service = new LifestyleService(
      prisma as unknown as PrismaService,
      credits as unknown as CreditService,
    );
    expect(await service.requestPhoto('u', 'c', { requestId: 'request' })).toBe(
      saved,
    );
    expect(credits.consumeCredits).not.toHaveBeenCalled();
  });
  it('snapshots entitlement policy at grant instead of changing current memberships when plan is edited', async () => {
    const entitlementPolicy = {
      kind: 'paid',
      dailyPhoto: true,
      dailyText: true,
    };
    const tx = {
      subscription: {
        findUniqueOrThrow: jest.fn().mockResolvedValue({ entitlementPolicy }),
      },
      userSubscription: {
        findMany: jest.fn().mockResolvedValue([]),
        create: jest.fn().mockResolvedValue({
          id: 's',
          creditAllowance: 0,
          endsAt: new Date(),
        }),
      },
      user: { update: jest.fn() },
      notification: { create: jest.fn() },
    };
    await grantSubscriptionCredits(tx as unknown as Prisma.TransactionClient, {
      userId: 'u',
      subscriptionId: 'plan',
      startsAt: new Date(),
      endsAt: new Date(),
      messageLimit: 0,
      creditAllowance: 0,
    });
    expect(tx.userSubscription.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ entitlementPolicy }),
    });
  });
});
