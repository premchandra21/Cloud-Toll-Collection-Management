import { prisma } from "../../config/database.js";
import { Prisma } from "../../generated/prisma/client.js";

// All dashboard numbers are aggregated INSIDE PostgreSQL (spec section 3.1: raw SQL for aggregations).
// Parameterised tagged templates only. Nothing from the request is ever concatenated into SQL.
//
// Output choices that keep the driver from changing types:
//   - counts are cast to int (otherwise they arrive as BigInt)
//   - money is cast to numeric(14,2) and then text, so it leaves as "160.00", never a float
//   - enum columns are cast to text
//
// Time filter: "processedAt" is a timestamp WITHOUT time zone that holds UTC. The incoming ISO strings
// carry an offset, so they are read as timestamptz and converted to naive UTC with AT TIME ZONE 'UTC'.
// That makes the result independent of the database session's time zone. NULL means "no bound".

export interface RangeParams {
  from: string | null; // ISO, inclusive
  to: string | null; // ISO, exclusive
  // null = every plaza (ADMIN). An array = only these plazas (OPERATOR); [] matches nothing.
  plazaIds: string[] | null;
}

// "AND <column> IN (...)" for a restricted caller. Every id is a bound parameter (never concatenated);
// the column is a fixed string written in this file, never request input.
function plazaFilter(column: string, plazaIds: string[] | null) {
  if (plazaIds === null) return Prisma.empty;
  if (plazaIds.length === 0) return Prisma.sql`AND FALSE`;
  const ids = Prisma.join(plazaIds.map((id) => Prisma.sql`${id}::uuid`));
  return Prisma.sql`AND ${Prisma.raw(column)} IN (${ids})`;
}

export interface Counts {
  transactions: number;
  success: number;
  failed: number;
  revenue: string;
}

export interface TotalsRow extends Counts {
  uncollected: string; // sum of FAILED toll amounts (tolls that could not be collected)
}

export interface PlazaRow extends Counts {
  id: string;
  name: string;
  code: string;
}

export interface VehicleTypeRow extends Counts {
  vehicleType: string;
}

export interface DayRow extends Counts {
  day: string; // YYYY-MM-DD in the requested time zone
}

export const dashboardRepository = {
  async totals({ from, to, plazaIds }: RangeParams): Promise<TotalsRow> {
    const rows = await prisma.$queryRaw<TotalsRow[]>`
      SELECT
        COUNT(*)::int AS "transactions",
        COUNT(*) FILTER (WHERE t."status" = 'SUCCESS')::int AS "success",
        COUNT(*) FILTER (WHERE t."status" = 'FAILED')::int AS "failed",
        COALESCE(SUM(t."amount") FILTER (WHERE t."status" = 'SUCCESS'), 0)::numeric(14,2)::text AS "revenue",
        COALESCE(SUM(t."amount") FILTER (WHERE t."status" = 'FAILED'), 0)::numeric(14,2)::text AS "uncollected"
      FROM "toll_transactions" t
      WHERE (${from}::timestamptz IS NULL OR t."processedAt" >= (${from}::timestamptz AT TIME ZONE 'UTC'))
        AND (${to}::timestamptz IS NULL OR t."processedAt" < (${to}::timestamptz AT TIME ZONE 'UTC'))
        ${plazaFilter('t."plazaId"', plazaIds)}
    `;
    return rows[0];
  },

  // LEFT JOIN with the time filter in the ON clause, so plazas with no tolls in the range still
  // appear with zeros instead of disappearing from the dashboard.
  byPlaza({ from, to, plazaIds }: RangeParams) {
    return prisma.$queryRaw<PlazaRow[]>`
      SELECT
        p."id"::text AS "id", p."name", p."code",
        COUNT(t."id")::int AS "transactions",
        COUNT(t."id") FILTER (WHERE t."status" = 'SUCCESS')::int AS "success",
        COUNT(t."id") FILTER (WHERE t."status" = 'FAILED')::int AS "failed",
        COALESCE(SUM(t."amount") FILTER (WHERE t."status" = 'SUCCESS'), 0)::numeric(14,2)::text AS "revenue"
      FROM "toll_plazas" p
      LEFT JOIN "toll_transactions" t
        ON t."plazaId" = p."id"
       AND (${from}::timestamptz IS NULL OR t."processedAt" >= (${from}::timestamptz AT TIME ZONE 'UTC'))
       AND (${to}::timestamptz IS NULL OR t."processedAt" < (${to}::timestamptz AT TIME ZONE 'UTC'))
      WHERE TRUE ${plazaFilter('p."id"', plazaIds)}
      GROUP BY p."id", p."name", p."code"
      ORDER BY COALESCE(SUM(t."amount") FILTER (WHERE t."status" = 'SUCCESS'), 0) DESC, p."name"
    `;
  },

  // Grouped by the vehicle type of the RATE that was applied, so history stays correct even if a
  // vehicle's type is edited later. All four types are listed, with zeros when there was no traffic.
  byVehicleType({ from, to, plazaIds }: RangeParams) {
    return prisma.$queryRaw<VehicleTypeRow[]>`
      SELECT
        vt."vehicleType"::text AS "vehicleType",
        COUNT(x."id")::int AS "transactions",
        COUNT(x."id") FILTER (WHERE x."status" = 'SUCCESS')::int AS "success",
        COUNT(x."id") FILTER (WHERE x."status" = 'FAILED')::int AS "failed",
        COALESCE(SUM(x."amount") FILTER (WHERE x."status" = 'SUCCESS'), 0)::numeric(14,2)::text AS "revenue"
      FROM (SELECT unnest(enum_range(NULL::"VehicleType")) AS "vehicleType") vt
      LEFT JOIN (
        SELECT t."id", t."status", t."amount", r."vehicleType" AS "rateVehicleType"
        FROM "toll_transactions" t
        JOIN "toll_rates" r ON r."id" = t."rateId"
        WHERE (${from}::timestamptz IS NULL OR t."processedAt" >= (${from}::timestamptz AT TIME ZONE 'UTC'))
          AND (${to}::timestamptz IS NULL OR t."processedAt" < (${to}::timestamptz AT TIME ZONE 'UTC'))
          ${plazaFilter('t."plazaId"', plazaIds)}
      ) x ON x."rateVehicleType" = vt."vehicleType"
      GROUP BY vt."vehicleType"
      ORDER BY vt."vehicleType"
    `;
  },

  // Calendar days in the caller's time zone (a toll at 23:30 IST belongs to that IST day, not the UTC one).
  // Newest 90 days only, so an "all time" request cannot return an unbounded series.
  byDay({ from, to, plazaIds }: RangeParams, tz: string) {
    return prisma.$queryRaw<DayRow[]>`
      SELECT
        to_char(d."day", 'YYYY-MM-DD') AS "day",
        COUNT(*)::int AS "transactions",
        COUNT(*) FILTER (WHERE d."status" = 'SUCCESS')::int AS "success",
        COUNT(*) FILTER (WHERE d."status" = 'FAILED')::int AS "failed",
        COALESCE(SUM(d."amount") FILTER (WHERE d."status" = 'SUCCESS'), 0)::numeric(14,2)::text AS "revenue"
      FROM (
        SELECT
          date_trunc('day', (t."processedAt" AT TIME ZONE 'UTC') AT TIME ZONE ${tz}::text) AS "day",
          t."status", t."amount"
        FROM "toll_transactions" t
        WHERE (${from}::timestamptz IS NULL OR t."processedAt" >= (${from}::timestamptz AT TIME ZONE 'UTC'))
          AND (${to}::timestamptz IS NULL OR t."processedAt" < (${to}::timestamptz AT TIME ZONE 'UTC'))
          ${plazaFilter('t."plazaId"', plazaIds)}
      ) d
      GROUP BY d."day"
      ORDER BY d."day" DESC
      LIMIT 90
    `;
  },
};