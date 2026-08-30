-- CreateTable
CREATE TABLE "companions" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "age" INTEGER NOT NULL,
    "profession" TEXT NOT NULL,
    "location" TEXT NOT NULL,
    "bio" TEXT NOT NULL,
    "personalityTraits" TEXT[],
    "interests" TEXT[],
    "communicationStyle" TEXT NOT NULL,
    "lifestyle" TEXT NOT NULL,
    "backstory" TEXT,
    "voiceDescription" TEXT[],
    "profileImage" TEXT,
    "coverImage" TEXT,
    "galleryImages" TEXT[],
    "status" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "companions_pkey" PRIMARY KEY ("id")
);
