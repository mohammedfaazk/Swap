-- CreateTable
CREATE TABLE "Swap" (
    "id" TEXT NOT NULL,
    "swapId" BYTEA NOT NULL,
    "initiator" TEXT NOT NULL,
    "resolver" TEXT NOT NULL,
    "amount" TEXT NOT NULL,
    "hashlock" BYTEA NOT NULL,
    "timelock" INTEGER NOT NULL,
    "stellarAccount" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "enablePartialFill" BOOLEAN NOT NULL,
    "minimumFill" TEXT,
    "filledAmount" TEXT NOT NULL,
    "merkleRoot" BYTEA,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Swap_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Resolver" (
    "address" TEXT NOT NULL,
    "endpoint" TEXT NOT NULL,
    "stake" TEXT NOT NULL,
    "successfulSwaps" INTEGER NOT NULL,
    "totalSwaps" INTEGER NOT NULL,
    "reputation" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Resolver_pkey" PRIMARY KEY ("address")
);

-- CreateTable
CREATE TABLE "PartialFill" (
    "id" TEXT NOT NULL,
    "swapId" TEXT NOT NULL,
    "secretIndex" INTEGER NOT NULL,
    "secretUsed" BOOLEAN NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PartialFill_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Swap_swapId_key" ON "Swap"("swapId");

-- CreateIndex
CREATE INDEX "PartialFill_swapId_idx" ON "PartialFill"("swapId");

-- CreateIndex
CREATE UNIQUE INDEX "PartialFill_swapId_secretIndex_key" ON "PartialFill"("swapId", "secretIndex");
