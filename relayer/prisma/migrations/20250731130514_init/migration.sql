/*
  Warnings:

  - The primary key for the `PartialFill` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - You are about to drop the column `secretUsed` on the `PartialFill` table. All the data in the column will be lost.
  - You are about to drop the column `updatedAt` on the `PartialFill` table. All the data in the column will be lost.
  - The `id` column on the `PartialFill` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The primary key for the `Resolver` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - You are about to drop the column `swapId` on the `Swap` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[address]` on the table `Resolver` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `fillAmount` to the `PartialFill` table without a default value. This is not possible if the table is not empty.
  - Added the required column `resolver` to the `PartialFill` table without a default value. This is not possible if the table is not empty.
  - Added the required column `secret` to the `PartialFill` table without a default value. This is not possible if the table is not empty.
  - Added the required column `toChain` to the `Swap` table without a default value. This is not possible if the table is not empty.

*/
-- DropIndex
DROP INDEX "public"."PartialFill_swapId_idx";

-- DropIndex
DROP INDEX "public"."PartialFill_swapId_secretIndex_key";

-- DropIndex
DROP INDEX "public"."Swap_swapId_key";

-- AlterTable
ALTER TABLE "public"."PartialFill" DROP CONSTRAINT "PartialFill_pkey",
DROP COLUMN "secretUsed",
DROP COLUMN "updatedAt",
ADD COLUMN     "fillAmount" TEXT NOT NULL,
ADD COLUMN     "resolver" TEXT NOT NULL,
ADD COLUMN     "secret" TEXT NOT NULL,
DROP COLUMN "id",
ADD COLUMN     "id" SERIAL NOT NULL,
ADD CONSTRAINT "PartialFill_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "public"."Resolver" DROP CONSTRAINT "Resolver_pkey",
ADD COLUMN     "id" SERIAL NOT NULL,
ADD COLUMN     "isAuthorized" BOOLEAN NOT NULL DEFAULT false,
ALTER COLUMN "successfulSwaps" SET DEFAULT 0,
ALTER COLUMN "totalSwaps" SET DEFAULT 0,
ALTER COLUMN "stake" SET DATA TYPE TEXT,
ADD CONSTRAINT "Resolver_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "public"."Swap" DROP COLUMN "swapId",
ADD COLUMN     "toChain" TEXT NOT NULL,
ALTER COLUMN "hashlock" SET DATA TYPE TEXT,
ALTER COLUMN "enablePartialFill" SET DEFAULT false,
ALTER COLUMN "filledAmount" DROP NOT NULL,
ALTER COLUMN "merkleRoot" SET DATA TYPE TEXT,
ALTER COLUMN "amount" SET DATA TYPE TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Resolver_address_key" ON "public"."Resolver"("address");
