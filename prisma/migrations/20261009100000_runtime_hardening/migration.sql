CREATE TABLE "request_limits" (
  "key" TEXT PRIMARY KEY,
  "count" INTEGER NOT NULL,
  "expiresAt" TIMESTAMPTZ NOT NULL
);
CREATE INDEX "request_limits_expiry_idx" ON "request_limits" ("expiresAt");

CREATE TABLE "telegram_jobs" (
  "id" TEXT PRIMARY KEY,
  "bot" TEXT NOT NULL,
  "chatId" TEXT NOT NULL,
  "payload" JSONB NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'pending',
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "availableAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "leaseUntil" TIMESTAMPTZ,
  "leaseToken" TEXT,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX "telegram_jobs_pending_idx" ON "telegram_jobs" ("status", "availableAt");
CREATE INDEX "telegram_jobs_chat_idx" ON "telegram_jobs" ("bot", "chatId", "status");
