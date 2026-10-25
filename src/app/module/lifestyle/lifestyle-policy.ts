import { BadRequestException } from '@nestjs/common';
import type { RoutineSlotDto } from './lifestyle.dto';

export function policy(value: unknown) {
  const p =
    value && typeof value === 'object'
      ? (value as Record<string, unknown>)
      : {};
  return {
    kind: p.kind === 'trial' ? 'trial' : 'paid',
    dailyPhoto: p.dailyPhoto === true,
    dailyText: p.dailyText === true,
    trialRepliesPerDay: Math.min(
      10,
      Math.max(1, Number(p.trialRepliesPerDay) || 10),
    ),
    trialRepliesTotal: Math.min(
      30,
      Math.max(1, Number(p.trialRepliesTotal) || 30),
    ),
    trialPhotosTotal: Math.min(3, Math.max(1, Number(p.trialPhotosTotal) || 3)),
  };
}
export function localClock(timezone: string, at = new Date()) {
  let parts: Intl.DateTimeFormatPart[];
  try {
    parts = new Intl.DateTimeFormat('en-GB', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    }).formatToParts(at);
  } catch {
    throw new BadRequestException('Use a valid IANA timezone');
  }
  const get = (k: string) => parts.find((p) => p.type === k)!.value;
  const day = `${get('year')}-${get('month')}-${get('day')}`;
  return {
    day,
    weekday: new Date(day + 'T12:00:00Z').getUTCDay() || 7,
    minute: Number(get('hour')) * 60 + Number(get('minute')),
    time: `${get('hour')}:${get('minute')}`,
  };
}
const minute = (s: string) => Number(s.slice(0, 2)) * 60 + Number(s.slice(3));
export function validateRoutine(timezone: string, slots: RoutineSlotDto[]) {
  localClock(timezone);
  const occupied = new Set<number>();
  for (const s of slots) {
    const start = minute(s.start),
      end = minute(s.end);
    if (start === end)
      throw new BadRequestException('Routine start and end must differ');
    const length = (end - start + 1440) % 1440;
    for (let n = 0; n < length; n++) {
      const key = ((s.day - 1) * 1440 + start + n) % 10080;
      if (occupied.has(key))
        throw new BadRequestException(
          'Routine slots overlap, including overnight slots',
        );
      occupied.add(key);
    }
  }
}
export function currentSlot(
  slots: RoutineSlotDto[],
  weekday: number,
  nowMinute: number,
) {
  return (
    slots.find((s) => {
      const start = minute(s.start),
        end = minute(s.end);
      return end > start
        ? s.day === weekday && nowMinute >= start && nowMinute < end
        : (s.day === weekday && nowMinute >= start) ||
            ((s.day % 7) + 1 === weekday && nowMinute < end);
    }) ?? null
  );
}
export function trialDay(start: Date, now = new Date()) {
  return `trial-${Math.floor((now.getTime() - start.getTime()) / 86400000)}`;
}
