-- AlterTable
ALTER TABLE "users" ADD COLUMN     "adultEligible" BOOLEAN,
ADD COLUMN     "isSubscribed" BOOLEAN NOT NULL DEFAULT false;
