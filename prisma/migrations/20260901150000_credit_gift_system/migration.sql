-- CreateEnum
CREATE TYPE "CreditDirection" AS ENUM ('credit', 'debit');
CREATE TYPE "CreditReason" AS ENUM ('purchase', 'extra_message', 'gift');
CREATE TYPE "ChatMessageType" AS ENUM ('text', 'gift');
CREATE TYPE "GiftTransactionStatus" AS ENUM ('completed', 'refunded');

-- CreateTable
CREATE TABLE "credit_packages" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "credits" INTEGER NOT NULL,
    "price" TEXT NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'usd',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "credit_packages_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "credit_transactions" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "companionId" TEXT,
    "direction" "CreditDirection" NOT NULL,
    "reason" "CreditReason" NOT NULL,
    "amount" INTEGER NOT NULL,
    "balanceBefore" INTEGER NOT NULL,
    "balanceAfter" INTEGER NOT NULL,
    "referenceId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "credit_transactions_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "gifts" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "image" TEXT,
    "creditCost" INTEGER NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "gifts_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "gift_transactions" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "companionId" TEXT NOT NULL,
    "giftId" TEXT NOT NULL,
    "creditCost" INTEGER NOT NULL,
    "status" "GiftTransactionStatus" NOT NULL DEFAULT 'completed',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "gift_transactions_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "payments" ADD COLUMN "creditPackageId" TEXT;
ALTER TABLE "chat_messages"
    ADD COLUMN "type" "ChatMessageType" NOT NULL DEFAULT 'text',
    ADD COLUMN "giftId" TEXT,
    ADD COLUMN "creditCost" INTEGER NOT NULL DEFAULT 0;

-- CreateIndex
CREATE INDEX "credit_transactions_userId_createdAt_idx" ON "credit_transactions"("userId", "createdAt");
CREATE INDEX "gift_transactions_userId_companionId_createdAt_idx" ON "gift_transactions"("userId", "companionId", "createdAt");

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_creditPackageId_fkey" FOREIGN KEY ("creditPackageId") REFERENCES "credit_packages"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "credit_transactions" ADD CONSTRAINT "credit_transactions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "credit_transactions" ADD CONSTRAINT "credit_transactions_companionId_fkey" FOREIGN KEY ("companionId") REFERENCES "companions"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "gift_transactions" ADD CONSTRAINT "gift_transactions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "gift_transactions" ADD CONSTRAINT "gift_transactions_companionId_fkey" FOREIGN KEY ("companionId") REFERENCES "companions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "gift_transactions" ADD CONSTRAINT "gift_transactions_giftId_fkey" FOREIGN KEY ("giftId") REFERENCES "gifts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "chat_messages" ADD CONSTRAINT "chat_messages_giftId_fkey" FOREIGN KEY ("giftId") REFERENCES "gifts"("id") ON DELETE SET NULL ON UPDATE CASCADE;
