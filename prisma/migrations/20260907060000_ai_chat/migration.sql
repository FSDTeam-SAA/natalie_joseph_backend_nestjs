ALTER TABLE "companions" ADD COLUMN "aiCompanionId" TEXT;
ALTER TABLE "chat_messages"
  ADD COLUMN "response" TEXT,
  ADD COLUMN "aiMessageId" TEXT,
  ADD COLUMN "conversationId" TEXT;

CREATE TABLE "chat_conversations" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "companionId" TEXT NOT NULL,
  "aiConversationId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "chat_conversations_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "chat_conversations_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "chat_conversations_companionId_fkey" FOREIGN KEY ("companionId") REFERENCES "companions"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "chat_conversations_aiConversationId_key" ON "chat_conversations"("aiConversationId");
CREATE UNIQUE INDEX "chat_conversations_userId_companionId_key" ON "chat_conversations"("userId", "companionId");
