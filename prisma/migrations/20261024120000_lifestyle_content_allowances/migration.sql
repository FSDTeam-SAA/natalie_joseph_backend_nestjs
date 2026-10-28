-- AlterTable
ALTER TABLE "subscriptions" ADD COLUMN     "entitlementPolicy" JSONB NOT NULL DEFAULT '{}';

-- AlterTable
ALTER TABLE "user_subscriptions" ADD COLUMN     "entitlementPolicy" JSONB NOT NULL DEFAULT '{}';

-- CreateTable
CREATE TABLE "companion_routines" (
    "companionId" TEXT NOT NULL,
    "timezone" TEXT NOT NULL DEFAULT 'Asia/Dubai',
    "weekly" JSONB NOT NULL DEFAULT '[]',
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "companion_routines_pkey" PRIMARY KEY ("companionId")
);

-- CreateTable
CREATE TABLE "library_photos" (
    "id" TEXT NOT NULL,
    "companionId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "publicId" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL DEFAULT 'image/jpeg',
    "caption" TEXT NOT NULL DEFAULT '',
    "tags" TEXT[],
    "approved" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "library_photos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "daily_content" (
    "id" TEXT NOT NULL,
    "companionId" TEXT NOT NULL,
    "day" TEXT NOT NULL,
    "publishAt" TIMESTAMP(3) NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "photoId" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "activity" TEXT NOT NULL DEFAULT '',
    "published" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "daily_content_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "daily_preferences" (
    "userId" TEXT NOT NULL,
    "companionId" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "daily_preferences_pkey" PRIMARY KEY ("userId")
);

-- CreateTable
CREATE TABLE "daily_deliveries" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "contentId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "telegramMessageId" INTEGER,
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "daily_deliveries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "allowance_usage" (
    "id" TEXT NOT NULL,
    "subscriptionId" TEXT NOT NULL,
    "day" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "allowance_usage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "library_photos_companionId_approved_idx" ON "library_photos"("companionId", "approved");

-- CreateIndex
CREATE INDEX "daily_content_published_publishAt_expiresAt_idx" ON "daily_content"("published", "publishAt", "expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "daily_content_companionId_day_key" ON "daily_content"("companionId", "day");

-- CreateIndex
CREATE INDEX "daily_deliveries_status_createdAt_idx" ON "daily_deliveries"("status", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "daily_deliveries_userId_contentId_kind_key" ON "daily_deliveries"("userId", "contentId", "kind");

-- CreateIndex
CREATE UNIQUE INDEX "allowance_usage_subscriptionId_day_action_key" ON "allowance_usage"("subscriptionId", "day", "action");

-- AddForeignKey
ALTER TABLE "companion_routines" ADD CONSTRAINT "companion_routines_companionId_fkey" FOREIGN KEY ("companionId") REFERENCES "companions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "library_photos" ADD CONSTRAINT "library_photos_companionId_fkey" FOREIGN KEY ("companionId") REFERENCES "companions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "daily_content" ADD CONSTRAINT "daily_content_companionId_fkey" FOREIGN KEY ("companionId") REFERENCES "companions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "daily_content" ADD CONSTRAINT "daily_content_photoId_fkey" FOREIGN KEY ("photoId") REFERENCES "library_photos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "daily_preferences" ADD CONSTRAINT "daily_preferences_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "daily_preferences" ADD CONSTRAINT "daily_preferences_companionId_fkey" FOREIGN KEY ("companionId") REFERENCES "companions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "daily_deliveries" ADD CONSTRAINT "daily_deliveries_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "daily_deliveries" ADD CONSTRAINT "daily_deliveries_contentId_fkey" FOREIGN KEY ("contentId") REFERENCES "daily_content"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "allowance_usage" ADD CONSTRAINT "allowance_usage_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES "user_subscriptions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
