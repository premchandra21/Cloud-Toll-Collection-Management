// Prints the ledger reconciliation result: for every wallet, balance == sum of its ledger entries,
// and every successful toll has exactly one matching debit. Exit code 0 = clean, 1 = mismatch.
//
//   npm run evidence:reconcile
//   npm run evidence:reconcile -- --api=https://your-api.example.com/api/v1
import { accounts, API, fail, login, reconciliation, warmUp } from "./lib.js";

await warmUp();
const admin = await login(accounts.admin);
const r = await reconciliation(admin);

console.log(`\nLedger reconciliation against ${API}`);
console.log(`  Wallets checked:                 ${r.wallets.checked}`);
console.log(`  Wallets with a mismatch:         ${r.wallets.mismatched}`);
console.log(`  Successful tolls:                ${r.tolls.successTolls}`);
console.log(`  Tolls missing a matching debit:  ${r.tolls.withoutMatchingDebit}`);
console.log(`  Debits with no successful toll:  ${r.tolls.debitsWithoutSuccessfulToll}`);
console.log(`  Tolls debited more than once:    ${r.tolls.duplicateDebits}`);
console.log(`  Unpaid pay-later tolls debited:  ${r.tolls.openCreditWithDebit}`);
if (r.wallets.mismatches.length > 0) console.log("\nMismatches:", r.wallets.mismatches);
console.log(`\n${r.ok ? "RESULT: PASS (0 mismatches)" : "RESULT: FAIL"}\n`);
if (!r.ok) fail("The ledger does not reconcile.");