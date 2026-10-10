import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../../prisma/generated/prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleDestroy {
  constructor() {
    const adapter = new PrismaPg({
      connectionString: process.env.DATABASE_URL as string,
      // Reuse remote database connections across normal pauses between messages.
      // pg otherwise closes idle connections after only 10 seconds.
      idleTimeoutMillis: 60000,
      connectionTimeoutMillis: 10000,
      max: Math.max(
        2,
        Math.min(50, Number(process.env.DATABASE_POOL_MAX) || 10),
      ),
    });
    super({ adapter });
  }
  async onModuleDestroy() {
    await this.$disconnect();
  }
}
