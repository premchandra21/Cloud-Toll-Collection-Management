import { env } from "../../config/env.js";
import { creditRepository } from "./credit.repository.js";

const DAY_MS = 86_400_000;

function formatDate(d: Date | null) {
  if (!d) return "soon";
  return d.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: env.CREDIT_TIMEZONE,
  });
}

const tolls = (n: number) => `${n} toll${n === 1 ? "" : "s"}`;

export const creditService = {
  // Sends "due soon" and "overdue" reminders for pay-later dues. Safe to run as often as you like:
  // each driver gets at most one reminder of each kind per 24 hours. Schedule it once a day
  // (cron / the host's scheduler running `npm run credit:remind`), or trigger it from the admin endpoint.
  // `userIds` limits the run to those drivers (used by the tests).
  async sendReminders(opts: { userIds?: string[] } = {}) {
    const dues = await creditRepository.findDues(env.CREDIT_REMIND_DAYS, opts.userIds);
    const recent = await creditRepository.recentReminders(
      dues.map((d) => d.userId),
      new Date(Date.now() - DAY_MS),
    );
    const already = new Set(recent.map((r) => `${r.userId}:${r.type}`));

    const rows: Parameters<typeof creditRepository.createNotifications>[0] = [];
    for (const d of dues) {
      if (d.overdueCount > 0 && !already.has(`${d.userId}:CREDIT_OVERDUE`)) {
        rows.push({
          userId: d.userId,
          type: "CREDIT_OVERDUE",
          title: "Pay-later dues overdue",
          message: `₹${d.overdueAmount} (${tolls(d.overdueCount)}) is overdue. Pay now to use pay-later again.`,
        });
      }
      if (d.dueSoonCount > 0 && !already.has(`${d.userId}:CREDIT_DUE_SOON`)) {
        rows.push({
          userId: d.userId,
          type: "CREDIT_DUE_SOON",
          title: "Pay-later dues due soon",
          message: `₹${d.dueSoonAmount} (${tolls(d.dueSoonCount)}) falls due by ${formatDate(d.nextDueAt)}. Please top up and pay in time.`,
        });
      }
    }
    if (rows.length > 0) await creditRepository.createNotifications(rows);

    return {
      driversWithDues: dues.length,
      overdueSent: rows.filter((r) => r.type === "CREDIT_OVERDUE").length,
      dueSoonSent: rows.filter((r) => r.type === "CREDIT_DUE_SOON").length,
    };
  },
};