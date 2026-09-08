-- Separate migration: new PostgreSQL enum values must commit before being used.
INSERT INTO "credit_costs" ("action", "credits", "updatedAt") VALUES
('message', 1, CURRENT_TIMESTAMP), ('photo', 5, CURRENT_TIMESTAMP),
('voice', 3, CURRENT_TIMESTAMP), ('low_credit_threshold', 10, CURRENT_TIMESTAMP)
ON CONFLICT ("action") DO NOTHING;

-- Earlier subscription spending was not itemized. Preserve an explicit opening
-- balance; do not invent historical transactions or their original timestamps.
INSERT INTO "credit_transactions" ("id", "userId", "direction", "reason", "source", "amount", "balanceBefore", "balanceAfter", "referenceId")
SELECT 'opening-' || "id", "userId", 'credit', 'opening_balance', 'subscription',
"creditAllowance" - "creditsUsed", 0, "creditAllowance" - "creditsUsed", "id"
FROM "user_subscriptions" WHERE "isActive" = true AND "creditAllowance" > "creditsUsed";

INSERT INTO "relationships" ("id", "userId", "companionId", "interactions", "lastInteractionAt", "createdAt", "updatedAt")
SELECT 'relationship-' || md5("userId" || ':' || "companionId"), "userId", "companionId", COUNT(*)::integer, MAX("createdAt"), MIN("createdAt"), CURRENT_TIMESTAMP
FROM "chat_messages" GROUP BY "userId", "companionId"
ON CONFLICT ("userId", "companionId") DO NOTHING;

UPDATE "users" u SET "isSubscribed" = EXISTS (SELECT 1 FROM "user_subscriptions" s WHERE s."userId" = u."id" AND s."isActive" = true AND s."startsAt" <= CURRENT_TIMESTAMP AND s."endsAt" > CURRENT_TIMESTAMP);
