import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../../prisma/generated/prisma/client';

export function databasePoolMax(env: NodeJS.ProcessEnv = process.env) {
  const configured = env.DATABASE_POOL_MAX?.trim();
  if (!configured) return 3;

  const value = Number(configured);
  if (!Number.isSafeInteger(value) || value < 1) {
    throw new Error('DATABASE_POOL_MAX must be a positive integer');
  }

  return Math.min(50, value);
}

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleDestroy {
  constructor() {
    const adapter = new PrismaPg({
      connectionString: process.env.DATABASE_URL as string,
      // Reuse remote database connections across normal pauses between messages.
      // pg otherwise closes idle connections after only 10 seconds.
      idleTimeoutMillis: 60000,
      connectionTimeoutMillis: 10000,
      // This limit is per application process. Keep the combined total of
      // production, workers and local development below the provider limit.
      max: databasePoolMax(),
    });
    super({ adapter });
  }
  async onModuleDestroy() {
    await this.$disconnect();
  }
}
