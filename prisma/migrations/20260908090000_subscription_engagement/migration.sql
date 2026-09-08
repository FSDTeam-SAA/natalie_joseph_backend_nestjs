-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "CreditReason" ADD VALUE 'opening_balance';
ALTER TYPE "CreditReason" ADD VALUE 'subscription_grant';
ALTER TYPE "CreditReason" ADD VALUE 'subscription_expiry';
ALTER TYPE "CreditReason" ADD VALUE 'expiry';
ALTER TYPE "CreditReason" ADD VALUE 'photo';
ALTER TYPE "CreditReason" ADD VALUE 'voice';

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "ChatMessageType" ADD VALUE 'voice';
ALTER TYPE "ChatMessageType" ADD VALUE 'photo';

-- AlterTable
ALTER TABLE "chat_messages" ADD COLUMN     "humanAdminId" TEXT,
ADD COLUMN     "sender" TEXT NOT NULL DEFAULT 'user';

-- AlterTable
ALTER TABLE "chat_conversations" ADD COLUMN     "assignedAdminId" TEXT,
ADD COLUMN     "mode" TEXT NOT NULL DEFAULT 'ai',
ALTER COLUMN "aiConversationId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "credit_transactions" ADD COLUMN     "source" TEXT NOT NULL DEFAULT 'purchased';

-- AlterTable
ALTER TABLE "payments" ADD COLUMN     "stripeInvoiceId" TEXT;

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "billingStatus" TEXT,
ADD COLUMN     "billingSubscriptionId" TEXT,
ADD COLUMN     "cancelAtPeriodEnd" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "lowCreditNotified" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "user_subscriptions" ADD COLUMN     "stripeInvoiceId" TEXT,
ADD COLUMN     "stripeSubscriptionId" TEXT;

-- CreateTable
CREATE TABLE "credit_costs" (
    "action" TEXT NOT NULL,
    "credits" INTEGER NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "credit_costs_pkey" PRIMARY KEY ("action")
);

-- CreateTable
CREATE TABLE "relationships" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "companionId" TEXT NOT NULL,
    "nickname" TEXT,
    "notes" TEXT,
    "interactions" INTEGER NOT NULL DEFAULT 0,
    "lastInteractionAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "relationships_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "story_events" (
    "id" TEXT NOT NULL,
    "companionId" TEXT NOT NULL,
    "day" DATE NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "published" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "story_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "photo_views" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "companionId" TEXT NOT NULL,
    "photoUrl" TEXT NOT NULL,
    "creditCost" INTEGER NOT NULL,
    "viewCount" INTEGER NOT NULL DEFAULT 1,
    "firstViewedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastViewedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "photo_views_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "referenceId" TEXT,
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "conversation_mode_events" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "adminId" TEXT NOT NULL,
    "mode" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "conversation_mode_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "relationships_userId_companionId_key" ON "relationships"("userId", "companionId");

-- CreateIndex
CREATE INDEX "story_events_published_day_idx" ON "story_events"("published", "day");

-- CreateIndex
CREATE UNIQUE INDEX "story_events_companionId_day_key" ON "story_events"("companionId", "day");

-- CreateIndex
CREATE INDEX "photo_views_userId_lastViewedAt_idx" ON "photo_views"("userId", "lastViewedAt");

-- CreateIndex
CREATE UNIQUE INDEX "photo_views_userId_companionId_photoUrl_key" ON "photo_views"("userId", "companionId", "photoUrl");

-- CreateIndex
CREATE INDEX "notifications_userId_readAt_createdAt_idx" ON "notifications"("userId", "readAt", "createdAt");

-- CreateIndex
CREATE INDEX "conversation_mode_events_conversationId_createdAt_idx" ON "conversation_mode_events"("conversationId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "payments_stripeInvoiceId_key" ON "payments"("stripeInvoiceId");

-- CreateIndex
CREATE UNIQUE INDEX "users_billingSubscriptionId_key" ON "users"("billingSubscriptionId");

-- CreateIndex
CREATE UNIQUE INDEX "user_subscriptions_stripeInvoiceId_key" ON "user_subscriptions"("stripeInvoiceId");

-- AddForeignKey
-- Repair legacy conversation IDs by the authoritative user/companion pair.
INSERT INTO "chat_conversations" ("id", "userId", "companionId", "createdAt", "updatedAt")
SELECT 'legacy-' || md5("userId" || ':' || "companionId"), "userId", "companionId", MIN("createdAt"), MAX("createdAt")
FROM "chat_messages" GROUP BY "userId", "companionId"
ON CONFLICT ("userId", "companionId") DO NOTHING;
UPDATE "chat_messages" m SET "conversationId" = c."id"
FROM "chat_conversations" c WHERE m."userId" = c."userId" AND m."companionId" = c."companionId";

ALTER TABLE "chat_messages" ADD CONSTRAINT "chat_messages_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "chat_conversations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "relationships" ADD CONSTRAINT "relationships_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "relationships" ADD CONSTRAINT "relationships_companionId_fkey" FOREIGN KEY ("companionId") REFERENCES "companions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "story_events" ADD CONSTRAINT "story_events_companionId_fkey" FOREIGN KEY ("companionId") REFERENCES "companions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "photo_views" ADD CONSTRAINT "photo_views_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "photo_views" ADD CONSTRAINT "photo_views_companionId_fkey" FOREIGN KEY ("companionId") REFERENCES "companions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conversation_mode_events" ADD CONSTRAINT "conversation_mode_events_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "chat_conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Validate new writes while leaving historical data available for reconciliation.
ALTER TABLE "credit_costs" ADD CONSTRAINT "credit_costs_nonnegative" CHECK ("credits" >= 0);
ALTER TABLE "users" ADD CONSTRAINT "wallet_nonnegative" CHECK ("creditBalance" >= 0) NOT VALID;
ALTER TABLE "purchased_credit_lots" ADD CONSTRAINT "credit_lot_valid" CHECK ("remainingAmount" >= 0 AND "remainingAmount" <= "originalAmount") NOT VALID;
ALTER TABLE "user_subscriptions" ADD CONSTRAINT "subscription_usage_valid" CHECK ("creditAllowance" >= 0 AND "creditsUsed" >= 0 AND "creditsUsed" <= "creditAllowance") NOT VALID;
ALTER TABLE "credit_transactions" ADD CONSTRAINT "ledger_arithmetic_valid" CHECK ("amount" > 0 AND "balanceBefore" >= 0 AND "balanceAfter" >= 0 AND (("direction" = 'credit' AND "balanceAfter" = "balanceBefore" + "amount") OR ("direction" = 'debit' AND "balanceAfter" = "balanceBefore" - "amount"))) NOT VALID;
ALTER TABLE "chat_conversations" ADD CONSTRAINT "conversation_mode_valid" CHECK ("mode" IN ('ai', 'human'));
ALTER TABLE "credit_transactions" ADD CONSTRAINT "credit_source_valid" CHECK ("source" IN ('subscription', 'purchased'));
