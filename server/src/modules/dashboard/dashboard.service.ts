import type { AuthUser } from "../../shared/types.js";
import { getPlazaScope } from "../plazas/plaza-access.js";
import { dashboardRepository } from "./dashboard.repository.js";
import type { Counts, RangeParams } from "./dashboard.repository.js";
import type { DashboardQuery } from "./dashboard.schema.js";

// plazaIds comes from getPlazaScope(): null for an ADMIN, the assigned plaza ids for an OPERATOR.
export function toRangeParams(q: { from?: Date; to?: Date }, plazaIds: string[] | null): RangeParams {
  return { from: q.from?.toISOString() ?? null, to: q.to?.toISOString() ?? null, plazaIds };
}

// Share of tolls that were collected, 0-100 with one decimal. null when there was no traffic.
function successRate(c: Counts): number | null {
  if (c.transactions === 0) return null;
  return Math.round((c.success / c.transactions) * 1000) / 10;
}

export const dashboardService = {
  async summary(query: DashboardQuery, actor: AuthUser) {
    const range = toRangeParams(query, await getPlazaScope(actor));

    // Independent read-only queries, so they can run in parallel.
    const [totals, byPlaza, byVehicleType, byDayDesc] = await Promise.all([
      dashboardRepository.totals(range),
      dashboardRepository.byPlaza(range),
      dashboardRepository.byVehicleType(range),
      dashboardRepository.byDay(range, query.tz),
    ]);

    return {
      range: { from: range.from, to: range.to, timeZone: query.tz },
      // Tells the page whether these numbers cover every plaza or only the operator's own.
      scope: { allPlazas: range.plazaIds === null },
      totals: { ...totals, successRate: successRate(totals) },
      byPlaza,
      byVehicleType,
      byDay: [...byDayDesc].reverse(), // oldest first, ready to plot left to right
    };
  },
};