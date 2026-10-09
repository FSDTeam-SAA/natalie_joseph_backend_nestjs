import {
  CanActivate,
  ExecutionContext,
  HttpException,
  Injectable,
} from '@nestjs/common';
import { createHash } from 'node:crypto';
import type { Request } from 'express';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class RequestLimitGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}
  async canActivate(context: ExecutionContext) {
    const req = context.switchToHttp().getRequest<Request>();
    const path = req.path.toLowerCase().replace(/\/+$/, '');
    const miniLogin = /^\/api\/v1\/telegram\/app\/login\//.test(path);
    const auth =
      path === '/api/v1/user' ||
      /^\/api\/v1\/auth\/(login|register|forgot-password|verify-otp|reset-password)$/.test(
        path,
      );
    if (req.method !== 'POST' || (!auth && !miniLogin)) return true;
    // req.ip trusts forwarding headers only when the deployment explicitly enables trust proxy.
    const keys: [string, number][] = [
      [
        `ip:${req.ip || req.socket.remoteAddress}:${miniLogin ? 'mini-login' : path}`,
        30,
      ],
    ];
    if (typeof req.body?.email === 'string')
      keys.push([
        `email:${req.body.email.trim().toLowerCase()}:${miniLogin ? 'login' : path}`,
        10,
      ]);
    for (const [raw, maximum] of keys) {
      const key = createHash('sha256').update(raw).digest('hex');
      const rows = await this.prisma.$queryRaw<{ count: number }[]>`
        INSERT INTO request_limits (key, count, "expiresAt") VALUES (${key}, 1, NOW() + INTERVAL '10 minutes')
        ON CONFLICT (key) DO UPDATE SET
          count = CASE WHEN request_limits."expiresAt" <= NOW() THEN 1 ELSE LEAST(request_limits.count + 1, 100000) END,
          "expiresAt" = CASE WHEN request_limits."expiresAt" <= NOW() THEN NOW() + INTERVAL '10 minutes' ELSE request_limits."expiresAt" END
        RETURNING count`;
      if (rows[0].count > maximum)
        throw new HttpException(
          'Too many attempts. Please try again in 10 minutes.',
          429,
        );
    }
    return true;
  }
}
