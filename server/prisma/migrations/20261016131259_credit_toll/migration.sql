-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "NotificationType" ADD VALUE 'CREDIT_USED';
ALTER TYPE "NotificationType" ADD VALUE 'CREDIT_DUE_SOON';
ALTER TYPE "NotificationType" ADD VALUE 'CREDIT_OVERDUE';
ALTER TYPE "NotificationType" ADD VALUE 'CREDIT_SETTLED';

-- AlterTable
ALTER TABLE "toll_transactions" ADD COLUMN     "creditDueAt" TIMESTAMP(3),
ADD COLUMN     "onCredit" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "settledAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "wallets" ADD COLUMN     "creditLimit" DECIMAL(12,2) NOT NULL DEFAULT 0,
ADD COLUMN     "monthlyCreditLimit" DECIMAL(12,2) NOT NULL DEFAULT 0;

-- CreateIndex
CREATE INDEX "toll_transactions_vehicleId_onCredit_settledAt_idx" ON "toll_transactions"("vehicleId", "onCredit", "settledAt");
