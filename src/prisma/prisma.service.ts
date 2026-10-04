import { Injectable } from '@nestjs/common';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../../prisma/generated/prisma/client';

@Injectable()
export class PrismaService extends PrismaClient {
  constructor() {
    const adapter = new PrismaPg({
      connectionString: process.env.DATABASE_URL as string,
      // Reuse remote database connections across normal pauses between messages.
      // pg otherwise closes idle connections after only 10 seconds.
      idleTimeoutMillis: 60000,
    });
    super({ adapter });
  }
}
