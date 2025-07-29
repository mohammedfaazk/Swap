/*
  Warnings:

  - Changed the type of `stake` on the `Resolver` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `amount` on the `Swap` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.

*/
-- AlterTable
ALTER TABLE "Resolver" DROP COLUMN "stake",
ADD COLUMN     "stake" DECIMAL(30,0) NOT NULL;

-- AlterTable
ALTER TABLE "Swap" DROP COLUMN "amount",
ADD COLUMN     "amount" DECIMAL(65,30) NOT NULL;
