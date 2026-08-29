-- CreateEnum
CREATE TYPE "Status" AS ENUM ('pending', 'approved', 'rejected');

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "otp" TEXT,
ADD COLUMN     "otpExpiry" TIMESTAMP(3),
ADD COLUMN     "phoneNumber" TEXT,
ADD COLUMN     "profileImage" TEXT,
ADD COLUMN     "status" "Status" NOT NULL DEFAULT 'approved',
ADD COLUMN     "stripeAccountId" TEXT,
ADD COLUMN     "verifiedForgot" BOOLEAN NOT NULL DEFAULT false;
