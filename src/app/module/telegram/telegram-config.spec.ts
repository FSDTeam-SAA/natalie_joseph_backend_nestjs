import { ConfigService } from '@nestjs/config';
import {
  botKeyForCompanion,
  botKeys,
  webhookSecret,
  websiteUrl,
} from './telegram-config';
import { TelegramService } from './telegram.service';
import { TelegramAiService } from './telegram-ai.service';

describe('Telegram configuration isolation', () => {
  const config = new ConfigService({
    ...Object.fromEntries(
      botKeys.map((key) => [`TELEGRAM_${key}_COMPANION_ID`, key.toLowerCase()]),
    ),
    TELEGRAM_WEBHOOK_SECRET: 'master-secret',
    TELEGRAM_CREDITS_URL: 'https://example.com/credits?campaign=test',
  });
  it.each(botKeys)('resolves %s without relying on display names', (key) => {
    expect(botKeyForCompanion(config, key.toLowerCase())).toBe(key);
  });
  it('rejects unknown or duplicate companion mappings', () => {
    expect(() => botKeyForCompanion(config, 'unknown')).toThrow();
    expect(() =>
      botKeyForCompanion(
        new ConfigService({
          TELEGRAM_ELENA_COMPANION_ID: 'same',
          TELEGRAM_CHLOE_COMPANION_ID: 'same',
        }),
        'same',
      ),
    ).toThrow();
  });
  it('rejects one bot secret on another bot route', () => {
    const service = new TelegramService(config, {} as TelegramAiService);
    expect(() =>
      service.verifySecret(webhookSecret(config, 'ELENA'), 'ELENA'),
    ).not.toThrow();
    expect(() =>
      service.verifySecret(webhookSecret(config, 'ELENA'), 'CHLOE'),
    ).toThrow('Invalid Telegram webhook secret');
  });
  it('retains campaign parameters and carries only companion context', () => {
    const url = new URL(websiteUrl(config, 'credits', 'elena'));
    expect(url.searchParams.get('campaign')).toBe('test');
    expect(url.searchParams.get('companionId')).toBe('elena');
    expect(url.searchParams.get('source')).toBe('telegram');
  });
  it('rejects missing and unsafe website links', () => {
    expect(() => websiteUrl(config, 'connect', 'elena')).toThrow(
      'TELEGRAM_CONNECT_URL',
    );
    expect(() =>
      websiteUrl(
        new ConfigService({ TELEGRAM_CREDITS_URL: 'javascript:alert(1)' }),
        'credits',
        'elena',
      ),
    ).toThrow();
  });
});
