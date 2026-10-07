-- CreateEnum
CREATE TYPE "VehicleType" AS ENUM ('CAR', 'BUS', 'TRUCK', 'HEAVY_VEHICLE');

-- CreateEnum
CREATE TYPE "WalletTransactionType" AS ENUM ('TOP_UP', 'TOLL_DEBIT', 'REFUND', 'ADJUSTMENT');

-- CreateEnum
CREATE TYPE "TollTransactionStatus" AS ENUM ('SUCCESS', 'FAILED');

-- CreateEnum
CREATE TYPE "NotificationType" AS ENUM ('LOW_BALANCE', 'TOLL_SUCCESS', 'TOLL_FAILED');

-- CreateTable
CREATE TABLE "vehicles" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "vehicleNumber" TEXT NOT NULL,
    "vehicleType" "VehicleType" NOT NULL,
    "rfidTag" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "vehicles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "wallets" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "balance" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "wallets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "wallet_transactions" (
    "id" UUID NOT NULL,
    "walletId" UUID NOT NULL,
    "type" "WalletTransactionType" NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "balanceAfter" DECIMAL(12,2) NOT NULL,
    "referenceType" TEXT,
    "referenceId" TEXT,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "wallet_transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "toll_plazas" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "location" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "toll_plazas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "toll_rates" (
    "id" UUID NOT NULL,
    "plazaId" UUID NOT NULL,
    "vehicleType" "VehicleType" NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "toll_rates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "toll_transactions" (
    "id" UUID NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "vehicleId" UUID NOT NULL,
    "plazaId" UUID NOT NULL,
    "rateId" UUID NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "status" "TollTransactionStatus" NOT NULL,
    "failureReason" TEXT,
    "processedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "toll_transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "type" "NotificationType" NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "vehicles_vehicleNumber_key" ON "vehicles"("vehicleNumber");

-- CreateIndex
CREATE UNIQUE INDEX "vehicles_rfidTag_key" ON "vehicles"("rfidTag");

-- CreateIndex
CREATE INDEX "vehicles_userId_idx" ON "vehicles"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "wallets_userId_key" ON "wallets"("userId");

-- CreateIndex
CREATE INDEX "wallet_transactions_walletId_createdAt_idx" ON "wallet_transactions"("walletId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "toll_plazas_code_key" ON "toll_plazas"("code");

-- CreateIndex
CREATE INDEX "toll_rates_plazaId_vehicleType_idx" ON "toll_rates"("plazaId", "vehicleType");

-- CreateIndex
CREATE UNIQUE INDEX "toll_transactions_idempotencyKey_key" ON "toll_transactions"("idempotencyKey");

-- CreateIndex
CREATE INDEX "toll_transactions_vehicleId_idx" ON "toll_transactions"("vehicleId");

-- CreateIndex
CREATE INDEX "toll_transactions_plazaId_idx" ON "toll_transactions"("plazaId");

-- CreateIndex
CREATE INDEX "toll_transactions_status_idx" ON "toll_transactions"("status");

-- CreateIndex
CREATE INDEX "toll_transactions_createdAt_idx" ON "toll_transactions"("createdAt");

-- CreateIndex
CREATE INDEX "notifications_userId_createdAt_idx" ON "notifications"("userId", "createdAt");

-- AddForeignKey
ALTER TABLE "vehicles" ADD CONSTRAINT "vehicles_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wallets" ADD CONSTRAINT "wallets_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wallet_transactions" ADD CONSTRAINT "wallet_transactions_walletId_fkey" FOREIGN KEY ("walletId") REFERENCES "wallets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "toll_rates" ADD CONSTRAINT "toll_rates_plazaId_fkey" FOREIGN KEY ("plazaId") REFERENCES "toll_plazas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "toll_transactions" ADD CONSTRAINT "toll_transactions_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "vehicles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "toll_transactions" ADD CONSTRAINT "toll_transactions_plazaId_fkey" FOREIGN KEY ("plazaId") REFERENCES "toll_plazas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "toll_transactions" ADD CONSTRAINT "toll_transactions_rateId_fkey" FOREIGN KEY ("rateId") REFERENCES "toll_rates"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Raw SQL: things Prisma's schema language cannot express

-- 1) Wallet balance can never go negative
ALTER TABLE "wallets"
  ADD CONSTRAINT "wallets_balance_non_negative" CHECK ("balance" >= 0);

-- 2) Only ONE active rate per plaza + vehicle type
CREATE UNIQUE INDEX "toll_rates_one_active_per_plaza_vehicle_type"
  ON "toll_rates" ("plazaId", "vehicleType")
  WHERE "isActive" = true;

-- 3) Extra safety on amounts
ALTER TABLE "toll_rates"
  ADD CONSTRAINT "toll_rates_amount_positive" CHECK ("amount" > 0);
ALTER TABLE "toll_transactions"
  ADD CONSTRAINT "toll_transactions_amount_positive" CHECK ("amount" > 0);