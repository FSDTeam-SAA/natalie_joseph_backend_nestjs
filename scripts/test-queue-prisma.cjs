// Real Prisma adapter, temporary tables and rollback only. Never sends Telegram messages.
require('dotenv').config({ quiet: true });
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { PrismaPg } = require('@prisma/adapter-pg');
const { PrismaClient } = require('../dist/prisma/generated/prisma/client');
const { ConfigService } = require('@nestjs/config');
const { TelegramQueueService } = require('../dist/src/app/module/telegram/telegram-queue.service');
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL, connectionTimeoutMillis: 10000, max: 1 }) });
const rollback = new Error('test rollback');
(async () => {
  try {
    await prisma.$transaction(async tx => {
      const migration = fs.readFileSync(path.join(__dirname, '../prisma/migrations/20261009100000_runtime_hardening/migration.sql'), 'utf8');
      for (const sql of migration.replaceAll('CREATE TABLE', 'CREATE TEMP TABLE').split(';').filter(s => s.trim())) await tx.$executeRawUnsafe(sql);
      await tx.$executeRawUnsafe('SET LOCAL search_path TO pg_temp, public');
      const adapter = { $queryRaw: (...args) => tx.$queryRaw(...args), $executeRaw: (...args) => tx.$executeRaw(...args), $transaction: fn => fn(adapter) };
      let delivered = 0;
      const queue = new TelegramQueueService(adapter, { receive: async () => { delivered++; } }, new ConfigService({ TELEGRAM_QUEUE_ENABLED: 'true', TELEGRAM_AUTO_REPLY_ENABLED: 'true' }));
      // Drive the worker deterministically while its connection is in this transaction.
      queue.wakeWorker = () => {};
      const update = { update_id: 1, message: { text: 'isolated test', chat: { id: 123, type: 'private' } } };
      await queue.receive(update);
      await queue.receive(update);
      await queue.drain();
      const rows = await tx.$queryRaw`SELECT status, payload FROM telegram_jobs`;
      assert.equal(rows.length, 1);
      assert.equal(rows[0].status, 'completed');
      assert.deepEqual(rows[0].payload, {});
      assert.equal(delivered, 1);
      throw rollback;
    }, { timeout: 20000 });
  } catch (error) {
    if (error !== rollback) throw error;
  }
  console.log('Real Prisma queue test passed: supported lock result, duplicate ingress, claim, completion, payload cleanup. Temporary tables rolled back; no live jobs or messages touched.');
})().catch(error => { console.error('Prisma queue test failed:', error.code || error.name); process.exitCode = 1; }).finally(() => prisma.$disconnect());
