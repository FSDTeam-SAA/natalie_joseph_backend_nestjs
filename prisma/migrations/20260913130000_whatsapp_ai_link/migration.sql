ALTER TABLE "chat_messages" ADD COLUMN "whatsappMessageKey" TEXT;
CREATE UNIQUE INDEX "chat_messages_whatsappMessageKey_key" ON "chat_messages"("whatsappMessageKey");
CREATE TABLE "whatsapp_connections" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "companionId" TEXT NOT NULL,
  "waId" TEXT,
  "linkTokenHash" TEXT,
  "linkExpiresAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "whatsapp_connections_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "whatsapp_connections_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "whatsapp_connections_companionId_fkey" FOREIGN KEY ("companionId") REFERENCES "companions"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "whatsapp_connections_linkTokenHash_key" ON "whatsapp_connections"("linkTokenHash");
CREATE UNIQUE INDEX "whatsapp_connections_userId_companionId_key" ON "whatsapp_connections"("userId", "companionId");
CREATE UNIQUE INDEX "whatsapp_connections_waId_companionId_key" ON "whatsapp_connections"("waId", "companionId");
