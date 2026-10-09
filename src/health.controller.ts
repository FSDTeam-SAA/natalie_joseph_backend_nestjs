import {
  Controller,
  Get,
  ServiceUnavailableException,
  SetMetadata,
} from '@nestjs/common';
import { PrismaService } from './prisma/prisma.service';
@Controller('health')
@SetMetadata('rawResponse', true)
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}
  @Get('live') live() {
    return { status: 'ok' };
  }
  @Get('ready') async ready() {
    try {
      const rows = await this.prisma.$queryRaw<
        { ready: boolean }[]
      >`SELECT (to_regclass('request_limits') IS NOT NULL AND to_regclass('telegram_jobs') IS NOT NULL) AS ready`;
      if (!rows[0]?.ready) throw new Error();
      return { status: 'ready' };
    } catch {
      throw new ServiceUnavailableException('Service not ready');
    }
  }
}
