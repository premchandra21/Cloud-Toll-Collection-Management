import { env } from "../../config/env.js";
import { prisma } from "../../config/database.js";
import { AppError } from "../../shared/errors/AppError.js";
import { fromCents, money, toCents } from "../../shared/utils/money.js";
import type { DecimalLike } from "../../shared/utils/money.js";
import { pageMeta } from "../../shared/utils/pagination.js";
import { getCreditUsage } from "../credit/credit.usage.js";
import { walletRepository } from "./wallet.repository.js";
import type { LedgerQuery, TopUpInput } from "./wallet.schema.js";

type LedgerRow = Awaited<ReturnType<typeof walletRepository.listLedger>>["rows"][number];

// Ledger amounts are SIGNED: credits are positive, toll debits (Slice 6) must be stored
// negative. That keeps the reconciliation check a plain SUM(amount) per wallet.
function toLedgerDto(r: LedgerRow) {
  return {
    id: r.id,
    type: r.type,
    amount: money(r.amount),
    balanceAfter: money(r.balanceAfter),
    referenceType: r.referenceType,
    referenceId: r.referenceId,
    description: r.description,
    createdAt: r.createdAt,
  };
}

async function requireWallet(userId: string) {
  const wallet = await walletRepository.findByUserId(userId);
  if (!wallet) throw new AppError(404, "WALLET_NOT_FOUND", "Wallet not found for this account");
  return wallet;
}

// The driver's pay-later position. `available` is how much more credit could be taken right now:
// the smaller of the room under the credit limit and the room left this month, 0 while anything is overdue.
function toCreditDto(
  wallet: { creditLimit: DecimalLike; monthlyCreditLimit: DecimalLike },
  usage: Awaited<ReturnType<typeof getCreditUsage>>,
) {
  const limit = toCents(wallet.creditLimit);
  const monthly = toCents(wallet.monthlyCreditLimit);
  const enabled = limit > 0 && monthly > 0;
  const room = Math.min(limit - toCents(usage.outstanding), monthly - toCents(usage.usedThisMonth));
  return {
    enabled,
    limit: fromCents(limit),
    monthlyLimit: fromCents(monthly),
    outstanding: usage.outstanding,
    usedThisMonth: usage.usedThisMonth,
    available: enabled && usage.overdueCount === 0 ? fromCents(Math.max(0, room)) : "0.00",
    hasOverdue: usage.overdueCount > 0,
    overdueAmount: usage.overdueAmount,
    overdueCount: usage.overdueCount,
    nextDueAt: usage.nextDueAt,
    dueDays: env.CREDIT_DUE_DAYS,
  };
}

export const walletService = {
  async getSummary(userId: string) {
    const wallet = await requireWallet(userId);
    const [totals, usage] = await Promise.all([
      walletRepository.totalsByType(wallet.id),
      getCreditUsage(prisma, userId, env.CREDIT_TIMEZONE),
    ]);

    const sumOf = (type: string) => totals.find((t) => t.type === type)?._sum.amount ?? null;
    const spent = sumOf("TOLL_DEBIT");

    return {
      balance: money(wallet.balance),
      updatedAt: wallet.updatedAt,
      lowBalance: wallet.balance.lte(env.LOW_BALANCE_THRESHOLD),
      lowBalanceThreshold: env.LOW_BALANCE_THRESHOLD.toFixed(2),
      totalToppedUp: money(sumOf("TOP_UP")),
      totalSpentOnTolls: money(spent ? spent.abs() : null),
      ledgerEntries: totals.reduce((n, t) => n + t._count._all, 0),
      credit: toCreditDto(wallet, usage),
    };
  },

  // Open pay-later dues with a per-row overdue flag (compared against the clock at request time).
  async listDues(userId: string) {
    await requireWallet(userId);
    const rows = await walletRepository.listOpenDues(userId);
    const now = Date.now();
    const dues = rows.map((r) => ({
      id: r.id,
      amount: money(r.amount),
      processedAt: r.processedAt,
      dueAt: r.creditDueAt,
      overdue: r.creditDueAt !== null && r.creditDueAt.getTime() < now,
      plaza: r.plaza,
      vehicleNumber: r.vehicle.vehicleNumber,
    }));
    return {
      dues,
      totalOutstanding: fromCents(dues.reduce((n, d) => n + toCents(d.amount), 0)),
    };
  },

  // "Pay my dues": settles as many whole dues as the balance covers, oldest first.
  async settleCredit(userId: string) {
    const wallet = await requireWallet(userId);
    const outcome = await walletRepository.settleCredit(wallet.id, userId);

    if (outcome.kind === "NONE_DUE") {
      throw new AppError(409, "NO_CREDIT_DUE", "You have no pay-later dues to pay");
    }
    if (outcome.kind === "TOO_LOW") {
      const missing = fromCents(toCents(outcome.oldestDue) - toCents(outcome.balance));
      throw new AppError(
        409,
        "INSUFFICIENT_BALANCE",
        `Your balance (₹${outcome.balance}) does not cover your oldest due (₹${outcome.oldestDue}). Top up at least ₹${missing} more.`,
      );
    }

    // After commit. A notification problem must never undo a payment.
    try {
      const n = outcome.settled.length;
      const rest =
        outcome.remainingCount > 0
          ? ` ₹${outcome.remainingAmount} (${outcome.remainingCount} toll${outcome.remainingCount === 1 ? "" : "s"}) still due.`
          : " All pay-later dues are cleared.";
      await walletRepository.createNotification({
        userId,
        type: "CREDIT_SETTLED",
        title: "Pay-later dues paid",
        message: `₹${outcome.settledAmount} was paid for ${n} toll${n === 1 ? "" : "s"}.${rest}`,
      });
    } catch (err) {
      console.error("[wallet] notification failed (payment itself is unaffected):", err);
    }

    return {
      settledCount: outcome.settled.length,
      settledAmount: outcome.settledAmount,
      balance: outcome.balance,
      remaining: { count: outcome.remainingCount, amount: outcome.remainingAmount },
      settled: outcome.settled,
    };
  },

  async topUp(userId: string, input: TopUpInput) {
    const wallet = await requireWallet(userId);
    const entry = await walletRepository.topUp(wallet.id, input.amount);
    return { balance: money(entry.balanceAfter), transaction: toLedgerDto(entry) };
  },

  async listLedger(userId: string, query: LedgerQuery) {
    const wallet = await requireWallet(userId);
    const { rows, total } = await walletRepository.listLedger(wallet.id, {
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
      type: query.type,
    });
    return {
      items: rows.map(toLedgerDto),
      meta: pageMeta(query.page, query.pageSize, total),
    };
  },
};