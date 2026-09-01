-- AlterTable
ALTER TABLE "users" ADD COLUMN "isFreeTrialUsed" BOOLEAN NOT NULL DEFAULT false;

-- Preserve free-trial history for users who activated a free plan before this
-- flag existed, so deployment cannot grant them another fresh quota.
UPDATE "users" AS u
SET "isFreeTrialUsed" = true
WHERE EXISTS (
    SELECT 1
    FROM "user_subscriptions" AS us
    INNER JOIN "subscriptions" AS s ON s."id" = us."subscriptionId"
    WHERE us."userId" = u."id"
      AND CAST(s."price" AS DECIMAL) = 0
);
