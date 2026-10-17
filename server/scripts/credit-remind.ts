// Sends the pay-later "due soon" / "overdue" reminders by calling the admin endpoint.
// Run it once a day from a scheduler (cron, or your host's scheduled job):
//
//   npm run credit:remind
//   npm run credit:remind -- --api=https://your-api.example.com/api/v1
//
// Safe to run more often: each driver gets at most one reminder of each kind per 24 hours.
import { accounts, API, call, fail, login, warmUp } from "./lib.js";

await warmUp();
const admin = await login(accounts.admin);
const r = await call("POST", "/credit/reminders/run", admin);
if (r.status !== 200) fail(`Reminder run failed (HTTP ${r.status}): ${r.json?.error?.message ?? ""}`);

console.log(`\nPay-later reminders against ${API}`);
console.log(`  Drivers with unpaid dues:  ${r.json.data.driversWithDues}`);
console.log(`  Overdue reminders sent:    ${r.json.data.overdueSent}`);
console.log(`  Due-soon reminders sent:   ${r.json.data.dueSoonSent}\n`);