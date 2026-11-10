import { ConfigService } from '@nestjs/config';
import { websiteUrl } from './telegram-config';

describe('Telegram purchase destinations', () => {
  it('sends a legacy credits pricing link to the actual credit dashboard', () => {
    const url = new URL(websiteUrl(new ConfigService({ TELEGRAM_CREDITS_URL: 'https://site.test/#pricing' }), 'credits', 'companion'));
    expect(url.pathname).toBe('/account');
    expect(url.hash).toBe('');
    expect(url.searchParams.get('tab')).toBe('subscription');
    expect(url.searchParams.get('companionId')).toBe('companion');
    expect(url.searchParams.get('source')).toBe('telegram');
  });
  it('preserves subscription pricing anchors and companion context', () => {
    const url = new URL(websiteUrl(new ConfigService({ TELEGRAM_SUBSCRIPTION_URL: 'https://site.test/#pricing' }), 'subscription', 'companion'));
    expect(url.hash).toBe('#pricing');
    expect(url.searchParams.get('companionId')).toBe('companion');
  });
  it('keeps explicitly configured credit destinations intact', () => {
    const url = new URL(websiteUrl(new ConfigService({ TELEGRAM_CREDITS_URL: 'https://site.test/custom-credits?offer=one' }), 'credits', 'companion'));
    expect(url.pathname).toBe('/custom-credits');
    expect(url.searchParams.get('offer')).toBe('one');
  });
});
