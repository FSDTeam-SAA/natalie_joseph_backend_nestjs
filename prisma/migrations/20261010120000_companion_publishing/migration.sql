CREATE TABLE "telegram_profile_sync" (
  "companionId" TEXT NOT NULL PRIMARY KEY REFERENCES "companions"("id") ON DELETE CASCADE,
  "displayName" TEXT, "about" TEXT, "description" TEXT, "photoUrl" TEXT,
  "version" INTEGER NOT NULL DEFAULT 1, "syncedVersion" INTEGER NOT NULL DEFAULT 0,
  "status" TEXT NOT NULL DEFAULT 'pending', "attempts" INTEGER NOT NULL DEFAULT 0,
  "nextAttemptAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "lockedUntil" TIMESTAMP(3), "leaseToken" TEXT, "lastError" TEXT,
  "syncedAt" TIMESTAMP(3), "updatedAt" TIMESTAMP(3) NOT NULL
);
CREATE TABLE "companion_media_stories" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "companionId" TEXT NOT NULL REFERENCES "companions"("id") ON DELETE CASCADE,
  "caption" TEXT NOT NULL DEFAULT '', "media" BYTEA NOT NULL, "mimeType" TEXT NOT NULL,
  "publishedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "expiresAt" TIMESTAMP(3) NOT NULL, "deletedAt" TIMESTAMP(3)
);
CREATE INDEX "companion_media_stories_companionId_expiresAt_idx"
ON "companion_media_stories"("companionId", "expiresAt");
