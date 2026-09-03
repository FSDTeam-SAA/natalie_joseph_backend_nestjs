-- Add subscription credit allowances while retaining message fields for API compatibility.
ALTER TABLE "subscriptions"
  ADD COLUMN "creditAllowance" INTEGER NOT NULL DEFAULT 0;

ALTER TABLE "user_subscriptions"
  ADD COLUMN "creditAllowance" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "creditsUsed" INTEGER NOT NULL DEFAULT 0;

-- Existing plans keep their current allowance after deployment.
UPDATE "subscriptions" SET "creditAllowance" = "messageLimit";
UPDATE "user_subscriptions"
SET "creditAllowance" = "messageLimit", "creditsUsed" = "messagesUsed";

CREATE TABLE "purchased_credit_lots" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "paymentId" TEXT NOT NULL,
  "originalAmount" INTEGER NOT NULL,
  "remainingAmount" INTEGER NOT NULL,
  "purchasedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "purchased_credit_lots_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "purchased_credit_lots_paymentId_key"
  ON "purchased_credit_lots"("paymentId");
CREATE INDEX "purchased_credit_lots_userId_expiresAt_remainingAmount_idx"
  ON "purchased_credit_lots"("userId", "expiresAt", "remainingAmount");
ALTER TABLE "purchased_credit_lots"
  ADD CONSTRAINT "purchased_credit_lots_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Preserve pre-existing wallet balances as expiring purchased-credit lots.
INSERT INTO "purchased_credit_lots"
  ("id", "userId", "paymentId", "originalAmount", "remainingAmount", "purchasedAt", "expiresAt", "createdAt", "updatedAt")
SELECT
  'legacy-' || "id", "id", 'legacy-' || "id", "creditBalance", "creditBalance",
  CURRENT_TIMESTAMP, CURRENT_TIMESTAMP + INTERVAL '90 days', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "users"
WHERE "creditBalance" > 0;
