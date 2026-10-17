import type { Prisma } from "../../generated/prisma/client.js";

// Anything with $queryRaw: the shared prisma client or a transaction client.
type Queryable = Pick<Prisma.TransactionClient, "$queryRaw">;

export interface CreditUsage {
  outstanding: string; // unsettled credit tolls, "160.00"
  overdueAmount: string; // part of that which is past its due date
  overdueCount: number;
  nextDueAt: Date | null; // earliest due date among unsettled credit tolls
  usedThisMonth: string; // credit taken since the start of the calendar month (settled or not)
}

// ONE aggregate over a driver's credit tolls (across all their vehicles), computed inside PostgreSQL.
// Used both by the toll flow (inside its locked transaction) and by the wallet summary, so the rule
// "what counts as outstanding / overdue / used this month" exists in exactly one place.
//
// "processedAt" / "creditDueAt" are timestamps WITHOUT time zone holding UTC, hence AT TIME ZONE 'UTC'.
// The month starts at local midnight of the 1st in `timeZone`.
export async function getCreditUsage(
  client: Queryable,
  userId: string,
  timeZone: string,
): Promise<CreditUsage> {
  const rows = await client.$queryRaw<
    {
      outstanding: string;
      overdueAmount: string;
      overdueCount: number;
      nextDueAt: Date | null;
      usedThisMonth: string;
    }[]
  >`
    SELECT
      COALESCE(SUM(t."amount") FILTER (WHERE t."settledAt" IS NULL), 0)::numeric(14,2)::text AS "outstanding",
      COALESCE(SUM(t."amount") FILTER (
        WHERE t."settledAt" IS NULL AND t."creditDueAt" < (now() AT TIME ZONE 'UTC')
      ), 0)::numeric(14,2)::text AS "overdueAmount",
      (COUNT(*) FILTER (
        WHERE t."settledAt" IS NULL AND t."creditDueAt" < (now() AT TIME ZONE 'UTC')
      ))::int AS "overdueCount",
      MIN(t."creditDueAt") FILTER (WHERE t."settledAt" IS NULL) AS "nextDueAt",
      COALESCE(SUM(t."amount") FILTER (
        WHERE t."processedAt" >= ((date_trunc('month', now() AT TIME ZONE ${timeZone}::text) AT TIME ZONE ${timeZone}::text) AT TIME ZONE 'UTC')
      ), 0)::numeric(14,2)::text AS "usedThisMonth"
    FROM "toll_transactions" t
    JOIN "vehicles" v ON v."id" = t."vehicleId"
    WHERE v."userId" = ${userId}::uuid AND t."onCredit" = true
  `;
  const r = rows[0]!;
  return { ...r, nextDueAt: r.nextDueAt ? new Date(r.nextDueAt) : null };
}