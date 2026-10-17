import { prisma } from "../../config/database.js";

export interface DuesRow {
  userId: string;
  overdueAmount: string;
  overdueCount: number;
  dueSoonAmount: string;
  dueSoonCount: number;
  nextDueAt: Date | null; // earliest due date that is still in the future
}

export const creditRepository = {
  // Drivers with unpaid pay-later tolls, split into "already overdue" and "falls due within N days".
  // Aggregated in PostgreSQL. creditDueAt is a timestamp WITHOUT time zone holding UTC.
  async findDues(remindDays: number, userIds?: string[]): Promise<DuesRow[]> {
    const onlyThese = userIds ?? null;
    const rows = await prisma.$queryRaw<DuesRow[]>`
      SELECT
        v."userId"::text AS "userId",
        COALESCE(SUM(t."amount") FILTER (WHERE t."creditDueAt" < (now() AT TIME ZONE 'UTC')), 0)::numeric(14,2)::text AS "overdueAmount",
        (COUNT(*) FILTER (WHERE t."creditDueAt" < (now() AT TIME ZONE 'UTC')))::int AS "overdueCount",
        COALESCE(SUM(t."amount") FILTER (
          WHERE t."creditDueAt" >= (now() AT TIME ZONE 'UTC')
            AND t."creditDueAt" < (now() AT TIME ZONE 'UTC') + (${remindDays}::int * interval '1 day')
        ), 0)::numeric(14,2)::text AS "dueSoonAmount",
        (COUNT(*) FILTER (
          WHERE t."creditDueAt" >= (now() AT TIME ZONE 'UTC')
            AND t."creditDueAt" < (now() AT TIME ZONE 'UTC') + (${remindDays}::int * interval '1 day')
        ))::int AS "dueSoonCount",
        MIN(t."creditDueAt") FILTER (WHERE t."creditDueAt" >= (now() AT TIME ZONE 'UTC')) AS "nextDueAt"
      FROM "toll_transactions" t
      JOIN "vehicles" v ON v."id" = t."vehicleId"
      WHERE t."onCredit" = true AND t."settledAt" IS NULL
        AND (${onlyThese}::uuid[] IS NULL OR v."userId" = ANY(${onlyThese}::uuid[]))
      GROUP BY v."userId"
    `;
    return rows.map((r) => ({ ...r, nextDueAt: r.nextDueAt ? new Date(r.nextDueAt) : null }));
  },

  // Which of these drivers were already sent a reminder of each kind since `since` (so a daily job
  // never sends the same reminder twice in a day).
  async recentReminders(userIds: string[], since: Date) {
    if (userIds.length === 0) return [];
    return prisma.notification.findMany({
      where: {
        userId: { in: userIds },
        type: { in: ["CREDIT_DUE_SOON", "CREDIT_OVERDUE"] },
        createdAt: { gte: since },
      },
      select: { userId: true, type: true },
    });
  },

  createNotifications(
    rows: { userId: string; type: "CREDIT_DUE_SOON" | "CREDIT_OVERDUE"; title: string; message: string }[],
  ) {
    return prisma.notification.createMany({ data: rows });
  },
};