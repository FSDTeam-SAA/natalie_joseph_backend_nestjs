/*
  Warnings:

  - You are about to drop the column `aiCompanionId` on the `companions` table. All the data in the column will be lost.
  - You are about to drop the column `bio` on the `companions` table. All the data in the column will be lost.
  - You are about to drop the column `communicationStyle` on the `companions` table. All the data in the column will be lost.
  - You are about to drop the column `lifestyle` on the `companions` table. All the data in the column will be lost.
  - You are about to drop the column `location` on the `companions` table. All the data in the column will be lost.
  - You are about to drop the column `profession` on the `companions` table. All the data in the column will be lost.
  - You are about to drop the column `traits` on the `companions` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "companions" DROP COLUMN "aiCompanionId",
DROP COLUMN "bio",
DROP COLUMN "communicationStyle",
DROP COLUMN "lifestyle",
DROP COLUMN "location",
DROP COLUMN "profession",
DROP COLUMN "traits",
ADD COLUMN     "version" INTEGER NOT NULL DEFAULT 1,
ALTER COLUMN "age" DROP NOT NULL;

-- CreateTable
CREATE TABLE "companion_personalities" (
    "id" TEXT NOT NULL,
    "companionId" TEXT NOT NULL,
    "traits" TEXT[],
    "about" TEXT NOT NULL,
    "essence" TEXT NOT NULL,
    "sharedTraits" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "companion_personalities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "companion_communication_styles" (
    "id" TEXT NOT NULL,
    "companionId" TEXT NOT NULL,
    "styleTraits" TEXT[],
    "topicsSheEnjoys" TEXT NOT NULL,
    "whatYouExperience" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "companion_communication_styles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "companion_backgrounds" (
    "id" TEXT NOT NULL,
    "companionId" TEXT NOT NULL,
    "location" TEXT NOT NULL,
    "occupation" TEXT NOT NULL,
    "lifestyle" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "companion_backgrounds_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "companion_visual_profiles" (
    "id" TEXT NOT NULL,
    "companionId" TEXT NOT NULL,
    "aestheticKeywords" TEXT[],
    "note" TEXT,
    "referenceImages" TEXT[],
    "physicalIdentity" TEXT,
    "generationInstructions" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "companion_visual_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "companion_voices" (
    "id" TEXT NOT NULL,
    "companionId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "voiceId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "companion_voices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "companion_voice_settings" (
    "id" TEXT NOT NULL,
    "voiceId" TEXT NOT NULL,
    "stability" DOUBLE PRECISION NOT NULL,
    "similarityBoost" DOUBLE PRECISION NOT NULL,
    "style" DOUBLE PRECISION NOT NULL,
    "useSpeakerBoost" BOOLEAN NOT NULL,
    "speed" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "companion_voice_settings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "companion_personalities_companionId_key" ON "companion_personalities"("companionId");

-- CreateIndex
CREATE UNIQUE INDEX "companion_communication_styles_companionId_key" ON "companion_communication_styles"("companionId");

-- CreateIndex
CREATE UNIQUE INDEX "companion_backgrounds_companionId_key" ON "companion_backgrounds"("companionId");

-- CreateIndex
CREATE UNIQUE INDEX "companion_visual_profiles_companionId_key" ON "companion_visual_profiles"("companionId");

-- CreateIndex
CREATE UNIQUE INDEX "companion_voices_companionId_key" ON "companion_voices"("companionId");

-- CreateIndex
CREATE UNIQUE INDEX "companion_voice_settings_voiceId_key" ON "companion_voice_settings"("voiceId");

-- AddForeignKey
ALTER TABLE "companion_personalities" ADD CONSTRAINT "companion_personalities_companionId_fkey" FOREIGN KEY ("companionId") REFERENCES "companions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "companion_communication_styles" ADD CONSTRAINT "companion_communication_styles_companionId_fkey" FOREIGN KEY ("companionId") REFERENCES "companions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "companion_backgrounds" ADD CONSTRAINT "companion_backgrounds_companionId_fkey" FOREIGN KEY ("companionId") REFERENCES "companions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "companion_visual_profiles" ADD CONSTRAINT "companion_visual_profiles_companionId_fkey" FOREIGN KEY ("companionId") REFERENCES "companions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "companion_voices" ADD CONSTRAINT "companion_voices_companionId_fkey" FOREIGN KEY ("companionId") REFERENCES "companions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "companion_voice_settings" ADD CONSTRAINT "companion_voice_settings_voiceId_fkey" FOREIGN KEY ("voiceId") REFERENCES "companion_voices"("id") ON DELETE CASCADE ON UPDATE CASCADE;
