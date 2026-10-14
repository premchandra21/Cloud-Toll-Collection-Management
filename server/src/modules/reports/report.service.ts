import { dashboardRepository } from "../dashboard/dashboard.repository.js";
import { toRangeParams } from "../dashboard/dashboard.service.js";
import type { RevenueReportQuery } from "../dashboard/dashboard.schema.js";

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
  async revenue(query: RevenueReportQuery) {
    const range = toRangeParams(query);

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