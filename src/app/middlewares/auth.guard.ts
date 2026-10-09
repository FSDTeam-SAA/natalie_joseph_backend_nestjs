import {
  CanActivate,
  ExecutionContext,
  HttpException,
  Injectable,
  mixin,
  Type,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Request } from 'express';
import config from '../config';
import { PrismaService } from '../../prisma/prisma.service';
import { sessionVersion } from '../helper/session-version';

export interface JwtPayload {
  id: string;
  email: string;
  role: string;
  iat?: number;
  exp?: number;
  sessionVersion?: string;
}

declare global {
  namespace Express {
    interface Request {
      user?: JwtPayload;
    }
  }
}

export function AuthGuard(...roles: string[]): Type<CanActivate> {
  @Injectable()
  class MiddlewaresGuard implements CanActivate {
    constructor(
      readonly jwtService: JwtService,
      private readonly prisma: PrismaService,
    ) {}
    async canActivate(context: ExecutionContext): Promise<boolean> {
      const request = context.switchToHttp().getRequest<Request>();
      const token = request.headers.authorization?.split(' ')[1];
      if (!token) throw new HttpException('Unauthorized', 401);

      const decoded = this.jwtService.verify<JwtPayload>(token, {
        secret: config.jwt.accessTokenSecret!,
      });
      if (!decoded) throw new HttpException('Unauthorized', 401);
      const user = await this.prisma.user.findUnique({
        where: { id: decoded.id },
        select: { password: true, role: true, status: true },
      });
      if (
        !user ||
        user.status !== 'approved' ||
        decoded.sessionVersion !== sessionVersion(user.password)
      )
        throw new HttpException('Session expired. Please log in again.', 401);
      decoded.role = user.role;

      if (roles.length && !roles.includes(decoded.role)) {
        throw new HttpException('Forbidden', 403);
      }
      request.user = decoded;
      return true;
    }
  }

  return mixin(MiddlewaresGuard);
}
