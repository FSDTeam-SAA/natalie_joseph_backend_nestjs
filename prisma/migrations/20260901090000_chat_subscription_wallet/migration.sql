-- AlterTable
ALTER TABLE "subscriptions" ADD COLUMN "durationDays" INTEGER NOT NULL DEFAULT 30;
ALTER TABLE "subscriptions" DROP CONSTRAINT "subscriptions_userId_fkey";
ALTER TABLE "subscriptions" DROP COLUMN "userId";

-- AlterTable
ALTER TABLE "users" ADD COLUMN "creditBalance" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "payments" ALTER COLUMN "subscriptionId" DROP NOT NULL;
ALTER TABLE "payments" ADD COLUMN "creditAmount" INTEGER;

-- CreateTable
CREATE TABLE "user_subscriptions" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "subscriptionId" TEXT NOT NULL,
    "messageLimit" INTEGER NOT NULL,
    "messagesUsed" INTEGER NOT NULL DEFAULT 0,
    "startsAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "user_subscriptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "chat_messages" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "companionId" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "usedCredit" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "chat_messages_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "user_subscriptions_userId_isActive_endsAt_idx" ON "user_subscriptions"("userId", "isActive", "endsAt");
CREATE INDEX "chat_messages_userId_companionId_createdAt_idx" ON "chat_messages"("userId", "companionId", "createdAt");

-- AddForeignKey
ALTER TABLE "user_subscriptions" ADD CONSTRAINT "user_subscriptions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "user_subscriptions" ADD CONSTRAINT "user_subscriptions_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES "subscriptions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "chat_messages" ADD CONSTRAINT "chat_messages_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "chat_messages" ADD CONSTRAINT "chat_messages_companionId_fkey" FOREIGN KEY ("companionId") REFERENCES "companions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
