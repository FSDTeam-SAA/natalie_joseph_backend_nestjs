/*
  Warnings:

  - You are about to drop the column `personalityTraits` on the `companions` table. All the data in the column will be lost.
  - Added the required column `slug` to the `companions` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "companions" DROP COLUMN "personalityTraits",
ADD COLUMN     "slug" TEXT NOT NULL,
ADD COLUMN     "traits" TEXT[];
