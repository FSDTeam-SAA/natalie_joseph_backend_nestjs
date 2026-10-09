import { NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac } from 'node:crypto';

export const botKeys = ['ELENA', 'CHLOE', 'LINA', 'LUNA', 'THALIA'] as const;
export type BotKey = (typeof botKeys)[number];

export function botKeyForCompanion(config: ConfigService, id: string): BotKey {
  const matches = botKeys.filter(
    (key) => config.get<string>(`TELEGRAM_${key}_COMPANION_ID`) === id,
  );
  if (matches.length !== 1)
    throw new NotFoundException(
      'Companion must have exactly one Telegram bot configured',
    );
  return matches[0];
}

export function botValue(
  config: ConfigService,
  key: BotKey,
  field: string,
): string {
  const value = config.get<string>(`TELEGRAM_${key}_${field}`)?.trim();
  if (!value)
    throw new ServiceUnavailableException(
      `TELEGRAM_${key}_${field} is required`,
    );
  return value;
}

export function webhookSecret(config: ConfigService, key: BotKey): string {
  const explicit = config.get<string>(`TELEGRAM_${key}_WEBHOOK_SECRET`);
  if (explicit) return explicit;
  const master = config.get<string>('TELEGRAM_WEBHOOK_SECRET');
  if (!master)
    throw new ServiceUnavailableException('Telegram webhook is not configured');
  return createHmac('sha256', master).update(key).digest('hex');
}

export function websiteUrl(
  config: ConfigService,
  kind: 'credits' | 'subscription' | 'connect',
  companionId: string,
): string {
  const setting = {
    credits: 'TELEGRAM_CREDITS_URL',
    subscription: 'TELEGRAM_SUBSCRIPTION_URL',
    connect: 'TELEGRAM_CONNECT_URL',
  }[kind];
  const raw = config.get<string>(setting);
  if (!raw) throw new ServiceUnavailableException(`${setting} is required`);
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new ServiceUnavailableException(
      `${setting} must be an absolute HTTP(S) URL`,
    );
  }
  if (
    !['https:', 'http:'].includes(url.protocol) ||
    url.username ||
    url.password
  )
    throw new ServiceUnavailableException(
      `${setting} must be an absolute HTTP(S) URL`,
    );
  url.searchParams.set('companionId', companionId);
  url.searchParams.set('source', 'telegram');
  return url.toString();
}

export type TelegramAction = {
  text: string;
  buttons: (
    { text: string; url: string } | { text: string; web_app: { url: string } }
  )[];
};

export function miniAppUrl(config: ConfigService, companionId: string) {
  const base = config.get<string>('TELEGRAM_PUBLIC_BASE_URL');
  if (!base)
    throw new ServiceUnavailableException(
      'TELEGRAM_PUBLIC_BASE_URL is required',
    );
  const url = new URL('/api/v1/telegram/app', base);
  if (url.protocol !== 'https:' || url.username || url.password)
    throw new ServiceUnavailableException(
      'Telegram login requires a public HTTPS backend',
    );
  url.searchParams.set('companionId', companionId);
  return url.toString();
}
