import { env } from "../../config/env.js";
import { AppError } from "../../shared/errors/AppError.js";
import { money } from "../../shared/utils/money.js";
import { pageMeta } from "../../shared/utils/pagination.js";
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

export const walletService = {
  async getSummary(userId: string) {
    const wallet = await requireWallet(userId);
    const totals = await walletRepository.totalsByType(wallet.id);

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