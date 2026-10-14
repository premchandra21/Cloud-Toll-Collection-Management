import { dashboardRepository } from "./dashboard.repository.js";
import type { Counts, RangeParams } from "./dashboard.repository.js";
import type { DashboardQuery } from "./dashboard.schema.js";

export function toRangeParams(q: { from?: Date; to?: Date }): RangeParams {
  return { from: q.from?.toISOString() ?? null, to: q.to?.toISOString() ?? null };
}

// Share of tolls that were collected, 0-100 with one decimal. null when there was no traffic.
function successRate(c: Counts): number | null {
  if (c.transactions === 0) return null;
  return Math.round((c.success / c.transactions) * 1000) / 10;
}

export const dashboardService = {
  async summary(query: DashboardQuery) {
    const range = toRangeParams(query);

    // Independent read-only queries, so they can run in parallel.
    const [totals, byPlaza, byVehicleType, byDayDesc] = await Promise.all([
      dashboardRepository.totals(range),
      dashboardRepository.byPlaza(range),
      dashboardRepository.byVehicleType(range),
      dashboardRepository.byDay(range, query.tz),
    ]);

    return {
      range: { from: range.from, to: range.to, timeZone: query.tz },
      totals: { ...totals, successRate: successRate(totals) },
      byPlaza,
      byVehicleType,
      byDay: [...byDayDesc].reverse(), // oldest first, ready to plot left to right
    };
  },
};