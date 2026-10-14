import { z } from "zod";
import { optionalQuery } from "../../shared/utils/query.js";

// Same convention as the transactions list: full ISO timestamps, `from` inclusive, `to` EXCLUSIVE.
const isoDateTime = z.iso.datetime({ offset: true }).transform((v) => new Date(v));

// IANA name such as "Asia/Kolkata". Used to decide which calendar day a toll belongs to.
function isValidTimeZone(tz: string) {
  try {
    new Intl.DateTimeFormat("en", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

const rangeShape = {
  from: optionalQuery(isoDateTime),
  to: optionalQuery(isoDateTime),
  tz: optionalQuery(z.string().trim().max(64).refine(isValidTimeZone, "Invalid time zone")).transform(
    (v) => v ?? "UTC",
  ),
};

type Range = { from?: Date; to?: Date };
const fromBeforeTo = (d: Range) => !d.from || !d.to || d.from < d.to;
const fromBeforeToIssue = { message: "'from' must be earlier than 'to'", path: ["from"] };

export const dashboardQuerySchema = z.object(rangeShape).refine(fromBeforeTo, fromBeforeToIssue);

export const REVENUE_GROUPS = ["day", "plaza", "vehicleType"] as const;

export const revenueReportQuerySchema = z
  .object({ ...rangeShape, groupBy: z.enum(REVENUE_GROUPS).default("day") })
  .refine(fromBeforeTo, fromBeforeToIssue);

export type DashboardQuery = z.infer<typeof dashboardQuerySchema>;
export type RevenueReportQuery = z.infer<typeof revenueReportQuerySchema>;
export type RevenueGroup = (typeof REVENUE_GROUPS)[number];