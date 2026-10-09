import {
  ConflictException,
  ForbiddenException,
  HttpException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { PrismaService } from '../../../prisma/prisma.service';
import { AuthService } from '../auth/auth.service';
import { ChatService } from '../chat/chat.service';
import {
  botKeyForCompanion,
  botValue,
  miniAppUrl,
  websiteUrl,
} from './telegram-config';

// Never trust initDataUnsafe or a Telegram ID supplied separately by the client.
export function verifyTelegramInitData(
  raw: string,
  token: string,
  now = Date.now(),
) {
  const params = new URLSearchParams(raw);
  const entries = [...params.entries()];
  if (new Set(entries.map(([key]) => key)).size !== entries.length)
    throw new UnauthorizedException('Invalid Telegram session');
  const hash = params.get('hash') || '';
  const check = entries
    .filter(([key]) => key !== 'hash')
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([key, value]) => `${key}=${value}`)
    .join('\n');
  const secret = createHmac('sha256', 'WebAppData').update(token).digest();
  const expected = createHmac('sha256', secret).update(check).digest();
  if (
    !/^[a-f0-9]{64}$/i.test(hash) ||
    !timingSafeEqual(expected, Buffer.from(hash, 'hex'))
  )
    throw new UnauthorizedException('Invalid Telegram session');
  const age = Math.floor(now / 1000) - Number(params.get('auth_date'));
  if (
    !params.get('auth_date') ||
    !Number.isFinite(age) ||
    age < -30 ||
    age > 600
  )
    throw new UnauthorizedException(
      'Session expired. Close this window and tap Log In again.',
    );
  try {
    const user = JSON.parse(params.get('user') || '{}') as {
      id?: number;
      is_bot?: boolean;
    };
    if (!Number.isSafeInteger(user.id) || user.id! <= 0 || user.is_bot)
      throw new Error();
    return String(user.id);
  } catch {
    throw new UnauthorizedException('Invalid Telegram user');
  }
}

@Injectable()
export class TelegramMiniAppService {
  private readonly attempts = new Map<
    string,
    { count: number; expires: number }
  >();
  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
    private readonly auth: AuthService,
    private readonly chat: ChatService,
  ) {}

  private identity(companionId: string, initData: string) {
    const key = botKeyForCompanion(this.config, companionId);
    return verifyTelegramInitData(
      initData,
      botValue(this.config, key, 'BOT_TOKEN'),
    );
  }

  private limit(key: string, maximum: number) {
    const now = Date.now();
    for (const [id, item] of this.attempts)
      if (item.expires <= now) this.attempts.delete(id);
    const item = this.attempts.get(key) || {
      count: 0,
      expires: now + 10 * 60 * 1000,
    };
    if (
      item.count >= maximum ||
      (!this.attempts.has(key) && this.attempts.size >= 10000)
    )
      throw new HttpException(
        'Too many attempts. Please try again in 10 minutes.',
        429,
      );
    item.count++;
    this.attempts.set(key, item);
  }

  async settings(companionId: string) {
    const key = botKeyForCompanion(this.config, companionId);
    const companion = await this.prisma.companions.findFirst({
      where: { id: companionId, status: true },
      select: { name: true },
    });
    if (!companion) throw new NotFoundException('Companion is unavailable');
    const page = (setting: string) => {
      const raw = this.config.get<string>(setting);
      if (!raw) return null;
      try {
        const url = new URL(raw);
        if (
          url.protocol !== 'https:' ||
          url.username ||
          url.password ||
          url.pathname === '/api/docs'
        )
          return null;
        url.searchParams.set('companionId', companionId);
        url.searchParams.set('source', 'telegram');
        url.searchParams.set('returnTo', miniAppUrl(this.config, companionId));
        return url.toString();
      } catch {
        return null;
      }
    };
    return {
      companionName: companion.name,
      botUrl: `https://t.me/${botValue(this.config, key, 'BOT_USERNAME').replace(/^@/, '')}`,
      registerUrl: page('TELEGRAM_REGISTER_URL'),
      forgotPasswordUrl: page('TELEGRAM_FORGOT_PASSWORD_URL'),
    };
  }

  async login(
    companionId: string,
    initData: string,
    email: string,
    password: string,
    confirmTransfer = false,
  ) {
    const telegramId = this.identity(companionId, initData);
    // Process-local limits. Production proxies must also rate-limit this endpoint across replicas.
    this.limit(`telegram:${telegramId}`, 10);
    this.limit(`email:${email.toLowerCase()}`, 10);
    const user = await this.auth.authenticate({ email, password });
    if (
      user.role !== 'user' ||
      user.status !== 'approved' ||
      user.adultEligible !== true
    )
      throw new ForbiddenException(
        'An approved adult user account is required.',
      );
    await this.settings(companionId);
    try {
      const transferRequired = await this.prisma.$transaction(async (tx) => {
        // Serializes competing links for this website user; the unique Telegram index
        // also prevents two website users claiming the same Telegram account.
        await tx.$queryRaw`SELECT id FROM users WHERE id = ${user.id} FOR UPDATE`;
        const existing = await tx.telegramConnection.findUnique({
          where: { userId_companionId: { userId: user.id, companionId } },
        });
        if (
          existing?.telegramId &&
          existing.telegramId !== telegramId &&
          !confirmTransfer
        )
          return true;
        await tx.telegramConnection.upsert({
          where: { userId_companionId: { userId: user.id, companionId } },
          create: { userId: user.id, companionId, telegramId },
          update: { telegramId, linkTokenHash: null, linkExpiresAt: null },
        });
        return false;
      });
      if (transferRequired) return { linked: false, transferRequired: true };
    } catch (error) {
      if ((error as { code?: string }).code === 'P2002')
        throw new ConflictException(
          'This Telegram account is connected to a different Meet Elysia account. Log in with that account or contact support.',
        );
      throw error;
    }
    return this.status(companionId, initData);
  }

  async status(companionId: string, initData: string) {
    const telegramId = this.identity(companionId, initData);
    this.limit(`status:${telegramId}`, 60);
    const companion = await this.prisma.companions.findFirst({
      where: { id: companionId, status: true },
      select: { id: true },
    });
    if (!companion) throw new NotFoundException('Companion is unavailable');
    const connection = await this.prisma.telegramConnection.findUnique({
      where: { telegramId_companionId: { telegramId, companionId } },
      select: { userId: true },
    });
    if (!connection) return { linked: false };
    const user = await this.prisma.user.findUnique({
      where: { id: connection.userId },
      select: { role: true, status: true, adultEligible: true },
    });
    if (
      !user ||
      user.role !== 'user' ||
      user.status !== 'approved' ||
      !user.adultEligible
    )
      throw new ForbiddenException(
        'An approved adult user account is required.',
      );
    const usage = await this.chat.getUsage(connection.userId);
    const state = !usage.subscription
      ? 'subscription_required'
      : usage.totalCredits <= 0
        ? 'credits_required'
        : 'ready';
    let actionUrl: string | null = null;
    if (state !== 'ready') {
      try {
        const url = new URL(
          websiteUrl(
            this.config,
            state === 'subscription_required' ? 'subscription' : 'credits',
            companionId,
          ),
        );
        if (url.protocol === 'https:' && url.pathname !== '/api/docs')
          actionUrl = url.toString();
      } catch {
        /* Missing checkout configuration must not undo a successful link. */
      }
    }
    return {
      linked: true,
      state,
      totalCredits: usage.totalCredits,
      endsAt: usage.subscription?.endsAt || null,
      actionUrl,
    };
  }
}
