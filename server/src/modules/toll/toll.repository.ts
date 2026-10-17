import { prisma } from "../../config/database.js";
import type { Prisma } from "../../generated/prisma/client.js";
import { fromCents, toCents } from "../../shared/utils/money.js";
import { getCreditUsage } from "../credit/credit.usage.js";

// Shape shared by every toll-transaction read (the list/detail endpoints in Slice 7 can reuse it).
const txSelect = {
  id: true,
  idempotencyKey: true,
  amount: true,
  status: true,
  failureReason: true,
  processedAt: true,
  plazaId: true,
  onCredit: true,
  creditDueAt: true,
  settledAt: true,
  vehicle: {
    select: { id: true, userId: true, vehicleNumber: true, vehicleType: true, rfidTag: true },
  },
  plaza: { select: { id: true, name: true, code: true } },
} as const;

interface ExecuteTollInput {
  idempotencyKey: string;
  vehicleId: string;
  plazaId: string;
  rateId: string;
  walletId: string;
  amount: string; // "80.00" - money stays a string, never a float
  // null = this wallet has no pay-later facility, so a short wallet simply FAILS (old behaviour).
  credit: { dueAt: Date; timeZone: string } | null;
}

export type CreditDenial =
  | "INSUFFICIENT_BALANCE"
  | "CREDIT_OVERDUE"
  | "CREDIT_LIMIT_EXCEEDED"
  | "CREDIT_MONTHLY_LIMIT_EXCEEDED";

type CreditDecision =
  | { allowed: true; outstandingAfter: string; limit: string }
  | { allowed: false; reason: CreditDenial };

// Decides whether a toll the wallet cannot cover may pass on credit.
// MUST run inside the toll's DB transaction AFTER the wallet row is locked (FOR UPDATE), so two
// tolls of the same driver can never both squeeze under the limit.
async function decideCredit(
  tx: Prisma.TransactionClient,
  walletId: string,
  amount: string,
  timeZone: string,
): Promise<CreditDecision> {
  const wallet = await tx.wallet.findUniqueOrThrow({
    where: { id: walletId },
    select: { userId: true, creditLimit: true, monthlyCreditLimit: true },
  });
  const limit = toCents(wallet.creditLimit);
  const monthly = toCents(wallet.monthlyCreditLimit);
  // Facility switched off after the caller's earlier read.
  if (limit <= 0 || monthly <= 0) return { allowed: false, reason: "INSUFFICIENT_BALANCE" };

  const { outstanding, overdueCount, usedThisMonth } = await getCreditUsage(tx, wallet.userId, timeZone);
  const need = toCents(amount);

  if (overdueCount > 0) return { allowed: false, reason: "CREDIT_OVERDUE" };
  if (toCents(outstanding) + need > limit) return { allowed: false, reason: "CREDIT_LIMIT_EXCEEDED" };
  if (toCents(usedThisMonth) + need > monthly) {
    return { allowed: false, reason: "CREDIT_MONTHLY_LIMIT_EXCEEDED" };
  }
  return { allowed: true, outstandingAfter: fromCents(toCents(outstanding) + need), limit: fromCents(limit) };
}

interface NotificationInput {
  userId: string;
  type:
  | "LOW_BALANCE"
  | "TOLL_SUCCESS"
  | "TOLL_FAILED"
  | "CREDIT_USED"
  | "CREDIT_DUE_SOON"
  | "CREDIT_OVERDUE"
  | "CREDIT_SETTLED";
  title: string;
  message: string;
}

export const tollRepository = {
  findByIdempotencyKey(idempotencyKey: string) {
    return prisma.tollTransaction.findUnique({ where: { idempotencyKey }, select: txSelect });
  },

  findVehicleByRfid(rfidTag: string) {
    return prisma.vehicle.findUnique({
      where: { rfidTag },
      select: { id: true, userId: true, vehicleNumber: true, vehicleType: true, isActive: true },
    });
  },

  findPlaza(id: string) {
    return prisma.tollPlaza.findUnique({
      where: { id },
      select: { id: true, name: true, code: true, isActive: true },
    });
  },

  findActiveRate(plazaId: string, vehicleType: "CAR" | "BUS" | "TRUCK" | "HEAVY_VEHICLE") {
    return prisma.tollRate.findFirst({
      where: { plazaId, vehicleType, isActive: true },
      select: { id: true, amount: true },
    });
  },

  findWalletByUserId(userId: string) {
    return prisma.wallet.findUnique({
      where: { userId },
      select: { id: true, balance: true, creditLimit: true, monthlyCreditLimit: true },
    });
  },

  // Steps 8-12 of the spec flow in ONE database transaction:
  //   1) conditional debit (a single UPDATE ... WHERE balance >= amount)
  //   2) if the wallet is short AND has a pay-later facility: lock the wallet row, re-try the debit
  //      (a top-up may have landed while we waited) and then check the credit rules
  //   3) toll transaction row: SUCCESS (paid), SUCCESS + onCredit (passed on credit, NO debit yet),
  //      or FAILED with the reason
  //   4) TOLL_DEBIT ledger row for a paid SUCCESS only, stored NEGATIVE so SUM(ledger) == balance
  // If any insert throws (e.g. duplicate idempotencyKey) the debit rolls back with it.
  executeToll(input: ExecuteTollInput) {
    const { idempotencyKey, vehicleId, plazaId, rateId, walletId, amount, credit } = input;

    return prisma.$transaction(
      async (tx) => {
        const debit = () =>
          tx.wallet.updateMany({
            where: { id: walletId, balance: { gte: amount } },
            data: { balance: { decrement: amount } },
          });

        let { count } = await debit();
        let decision: CreditDecision | null = null;
        if (count === 0 && credit) {
          await tx.$queryRaw`SELECT "id" FROM "wallets" WHERE "id" = ${walletId}::uuid FOR UPDATE`;
          ({ count } = await debit());
          if (count === 0) decision = await decideCredit(tx, walletId, amount, credit.timeZone);
        }

        // We still hold the row lock after a successful debit / the explicit lock, so this read is our own balance.
        const wallet = await tx.wallet.findUniqueOrThrow({
          where: { id: walletId },
          select: { balance: true },
        });

        if (count === 0) {
          if (decision?.allowed && credit) {
            const transaction = await tx.tollTransaction.create({
              data: {
                idempotencyKey,
                vehicleId,
                plazaId,
                rateId,
                amount,
                status: "SUCCESS",
                onCredit: true,
                creditDueAt: credit.dueAt,
              },
              select: txSelect,
            });
            return {
              transaction,
              balance: wallet.balance,
              creditPosition: { outstanding: decision.outstandingAfter, limit: decision.limit },
            };
          }

          const transaction = await tx.tollTransaction.create({
            data: {
              idempotencyKey,
              vehicleId,
              plazaId,
              rateId,
              amount,
              status: "FAILED",
              failureReason: decision && !decision.allowed ? decision.reason : "INSUFFICIENT_BALANCE",
            },
            select: txSelect,
          });
          return { transaction, balance: wallet.balance, creditPosition: null };
        }

        const transaction = await tx.tollTransaction.create({
          data: { idempotencyKey, vehicleId, plazaId, rateId, amount, status: "SUCCESS" },
          select: txSelect,
        });

        await tx.walletTransaction.create({
          data: {
            walletId,
            type: "TOLL_DEBIT",
            amount: `-${amount}`,
            balanceAfter: wallet.balance,
            referenceType: "TOLL_TRANSACTION",
            referenceId: transaction.id,
            description: `Toll at ${transaction.plaza.name} (${transaction.vehicle.vehicleNumber})`,
          },
        });

        return { transaction, balance: wallet.balance, creditPosition: null };
      },
      // Many requests can queue on one wallet row, so allow more than the 2s/5s defaults.
      { maxWait: 15_000, timeout: 30_000 },
    );
  },

  createNotifications(rows: NotificationInput[]) {
    return prisma.notification.createMany({ data: rows });
  },
};