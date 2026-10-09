// Integration test: temporary tables only, rolled back. Never migrates the real database.
require('dotenv').config({ quiet: true });
const { Client } = require('pg');
const { ConfigService } = require('@nestjs/config');
const { TelegramQueueService } = require('../dist/src/app/module/telegram/telegram-queue.service');
const { RequestLimitGuard } = require('../dist/src/app/middlewares/request-limit.guard');
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');

(async () => {
  const client = new Client({ connectionString: process.env.DATABASE_URL, connectionTimeoutMillis: 10000 });
  await client.connect();
  try {
    await client.query('BEGIN');
    const migration = fs.readFileSync(path.join(__dirname, '../prisma/migrations/20261009100000_runtime_hardening/migration.sql'), 'utf8');
    await client.query(migration.replaceAll('CREATE TABLE', 'CREATE TEMP TABLE'));
    await client.query('SET LOCAL search_path TO pg_temp, public');
    async function query(parts, ...values) {
      const sql = parts.reduce((s,p,i)=>s+(i?'$'+i:'')+p,'').replace('pg_advisory_xact_lock(193811, 1)', 'pg_advisory_xact_lock(193812, 1)');
      return client.query(sql, values);
    }
    const prisma = { $queryRaw: async (...args)=>(await query(...args)).rows, $executeRaw:async (...args)=>(await query(...args)).rowCount, $transaction:fn=>fn(prisma) };
    let delivered=0, fail=false;
    const queue = new TelegramQueueService(prisma,{receive:async()=>{if(fail)throw Error('simulated');delivered++;}},new ConfigService({TELEGRAM_QUEUE_ENABLED:'true',TELEGRAM_AUTO_REPLY_ENABLED:'true'}));
    const update = id=>({update_id:id,message:{text:'integration-test',chat:{id:123,type:'private'}}});
    await queue.receive(update(1));await queue.receive(update(1));
    assert.equal((await client.query('SELECT count(*)::int n FROM telegram_jobs')).rows[0].n,1);
    await queue.drain();assert.equal(delivered,1);
    let row=(await client.query('SELECT status,payload FROM telegram_jobs')).rows[0];assert.equal(row.status,'completed');assert.deepEqual(row.payload,{});
    fail=true;await queue.receive(update(2));await queue.drain();
    row=(await client.query("SELECT status,attempts FROM telegram_jobs WHERE id='ELENA:2'")).rows[0];assert.equal(row.status,'pending');assert.equal(row.attempts,1);
    await client.query("UPDATE telegram_jobs SET attempts=4, \"availableAt\"=NOW()-INTERVAL '1 second' WHERE id='ELENA:2'");
    await queue.drain();assert.equal((await client.query("SELECT status FROM telegram_jobs WHERE id='ELENA:2'")).rows[0].status,'failed');
    fail=false;await queue.receive(update(3));
    await client.query("UPDATE telegram_jobs SET status='processing', attempts=1, \"leaseUntil\"=NOW()-INTERVAL '1 second' WHERE id='ELENA:3'");
    await queue.drain();assert.equal(delivered,2);
    const guard = new RequestLimitGuard(prisma);
    const context={switchToHttp:()=>({getRequest:()=>({method:'POST',path:'/api/v1/auth/login',ip:'127.0.0.1',body:{email:'isolated@example.invalid'}})})};
    for(let i=0;i<10;i++)await guard.canActivate(context);
    await assert.rejects(()=>guard.canActivate(context),/Too many/);
    console.log('PostgreSQL temporary-table tests passed: duplicate ingress, delivery, retry, dead letter, expired lease recovery, shared rate limit.');
  } finally { await client.query('ROLLBACK');await client.end(); }
})().catch(error=>{console.error(error.message);process.exitCode=1;});
