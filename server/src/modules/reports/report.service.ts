import type { AuthUser } from "../../shared/types.js";
import { getPlazaScope } from "../plazas/plaza-access.js";
import { dashboardRepository } from "../dashboard/dashboard.repository.js";
import { toRangeParams } from "../dashboard/dashboard.service.js";
import type { RevenueReportQuery } from "../dashboard/dashboard.schema.js";
import { reconciliationRepository } from "./reconciliation.repository.js";

// One generic row shape so a client (or the evidence scripts) can handle every grouping the same way.
interface ReportRow {
  key: string; // plaza code, vehicle type or YYYY-MM-DD
  label: string;
  transactions: number;
  success: number;
  failed: number;
  revenue: string;
}

export const reportService = {
  async revenue(query: RevenueReportQuery, actor: AuthUser) {
    const range = toRangeParams(query, await getPlazaScope(actor));

    const [totals, rows] = await Promise.all([
      dashboardRepository.totals(range),
      loadRows(query, range),
    ]);

    return {
      groupBy: query.groupBy,
      range: { from: range.from, to: range.to, timeZone: query.tz },
      totals,
      rows,
    };
  },

  // Admin-only integrity check: does every wallet balance equal the sum of its ledger, and does
  // every successful toll have exactly one matching debit? ok=true means both are clean.
  async reconciliation() {
    const [walletsChecked, mismatchCount, mismatches, tolls] = await Promise.all([
      reconciliationRepository.countWallets(),
      reconciliationRepository.countWalletMismatches(),
      reconciliationRepository.findWalletMismatches(),
      reconciliationRepository.tollLedgerCounts(),
    ]);

    const tollsClean =
      tolls.withoutMatchingDebit === 0 &&
      tolls.debitsWithoutSuccessfulToll === 0 &&
      tolls.duplicateDebits === 0;

    return {
      checkedAt: new Date().toISOString(),
      ok: mismatchCount === 0 && tollsClean,
      wallets: { checked: walletsChecked, mismatched: mismatchCount, mismatches },
      tolls,
    };
  },
};

async function loadRows(
  query: RevenueReportQuery,
  range: ReturnType<typeof toRangeParams>,
): Promise<ReportRow[]> {
  if (query.groupBy === "plaza") {
    const rows = await dashboardRepository.byPlaza(range);
    return rows.map((r) => ({ key: r.code, label: r.name, ...pickCounts(r) }));
  }
  if (query.groupBy === "vehicleType") {
    const rows = await dashboardRepository.byVehicleType(range);
    return rows.map((r) => ({ key: r.vehicleType, label: r.vehicleType, ...pickCounts(r) }));
  }
  const rows = await dashboardRepository.byDay(range, query.tz);
  return [...rows].reverse().map((r) => ({ key: r.day, label: r.day, ...pickCounts(r) }));
}

function pickCounts(r: { transactions: number; success: number; failed: number; revenue: string }) {
  return { transactions: r.transactions, success: r.success, failed: r.failed, revenue: r.revenue };
}