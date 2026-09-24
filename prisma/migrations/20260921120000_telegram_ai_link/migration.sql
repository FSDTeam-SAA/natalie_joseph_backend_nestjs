CREATE TABLE "telegram_connections" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "companionId" TEXT NOT NULL,
  "telegramId" TEXT,
  "linkTokenHash" TEXT,
  "linkExpiresAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "telegram_connections_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "telegram_connections_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "telegram_connections_companionId_fkey" FOREIGN KEY ("companionId") REFERENCES "companions"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "telegram_connections_linkTokenHash_key" ON "telegram_connections"("linkTokenHash");
CREATE UNIQUE INDEX "telegram_connections_userId_companionId_key" ON "telegram_connections"("userId", "companionId");
CREATE UNIQUE INDEX "telegram_connections_telegramId_companionId_key" ON "telegram_connections"("telegramId", "companionId");
