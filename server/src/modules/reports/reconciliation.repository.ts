import { prisma } from "../../config/database.js";

// Ledger reconciliation (spec section 5.2 / 18.1). Read-only SQL, aggregated inside PostgreSQL.
// Money leaves the database as text ("160.00"), counts as int, so nothing turns into a float.

export interface WalletMismatchRow {
  walletId: string;
  email: string;
  balance: string; // wallets.balance
  ledgerSum: string; // SUM of the signed wallet_transactions.amount
  difference: string; // balance - ledgerSum (should never exist)
}

export interface TollLedgerCounts {
  successTolls: number;
  withoutMatchingDebit: number; // SUCCESS toll with no TOLL_DEBIT ledger row of exactly -amount
  debitsWithoutSuccessfulToll: number; // TOLL_DEBIT ledger row that points at no SUCCESS toll
  duplicateDebits: number; // a toll that was debited more than once
}

const MISMATCH_LIMIT = 50;

export const reconciliationRepository = {
  countWallets() {
    return prisma.wallet.count();
  },

  // Every wallet whose balance differs from the sum of its ledger. A wallet with no ledger rows counts as 0.
  findWalletMismatches() {
    return prisma.$queryRaw<WalletMismatchRow[]>`
      SELECT
        w."id"::text AS "walletId",
        u."email",
        w."balance"::numeric(14,2)::text AS "balance",
        COALESCE(SUM(l."amount"), 0)::numeric(14,2)::text AS "ledgerSum",
        (w."balance" - COALESCE(SUM(l."amount"), 0))::numeric(14,2)::text AS "difference"
      FROM "wallets" w
      JOIN "users" u ON u."id" = w."userId"
      LEFT JOIN "wallet_transactions" l ON l."walletId" = w."id"
      GROUP BY w."id", u."email", w."balance"
      HAVING w."balance" <> COALESCE(SUM(l."amount"), 0)
      ORDER BY u."email"
      LIMIT ${MISMATCH_LIMIT}
    `;
  },

  async countWalletMismatches() {
    const rows = await prisma.$queryRaw<{ count: number }[]>`
      SELECT COUNT(*)::int AS "count" FROM (
        SELECT w."id"
        FROM "wallets" w
        LEFT JOIN "wallet_transactions" l ON l."walletId" = w."id"
        GROUP BY w."id", w."balance"
        HAVING w."balance" <> COALESCE(SUM(l."amount"), 0)
      ) m
    `;
    return rows[0].count;
  },

  // Each SUCCESS toll must have exactly one matching debit, and every debit must belong to a SUCCESS toll.
  async tollLedgerCounts(): Promise<TollLedgerCounts> {
    const rows = await prisma.$queryRaw<TollLedgerCounts[]>`
      SELECT
        (SELECT COUNT(*) FROM "toll_transactions" WHERE "status" = 'SUCCESS')::int AS "successTolls",
        (SELECT COUNT(*) FROM "toll_transactions" t
          WHERE t."status" = 'SUCCESS'
            AND NOT EXISTS (
              SELECT 1 FROM "wallet_transactions" l
              WHERE l."type" = 'TOLL_DEBIT'
                AND l."referenceType" = 'TOLL_TRANSACTION'
                AND l."referenceId" = t."id"::text
                AND l."amount" = -t."amount"
            ))::int AS "withoutMatchingDebit",
        (SELECT COUNT(*) FROM "wallet_transactions" l
          WHERE l."type" = 'TOLL_DEBIT'
            AND NOT EXISTS (
              SELECT 1 FROM "toll_transactions" t
              WHERE t."id"::text = l."referenceId" AND t."status" = 'SUCCESS'
            ))::int AS "debitsWithoutSuccessfulToll",
        (SELECT COUNT(*) FROM (
          SELECT 1 FROM "wallet_transactions"
          WHERE "type" = 'TOLL_DEBIT'
          GROUP BY "referenceId"
          HAVING COUNT(*) > 1
        ) d)::int AS "duplicateDebits"
    `;
    return rows[0];
  },
};