import { env } from "../../config/env.js";
import { AppError } from "../../shared/errors/AppError.js";
import { money } from "../../shared/utils/money.js";
import type { DecimalLike } from "../../shared/utils/money.js";
import type { AuthUser } from "../../shared/types.js";
import { canAccessPlaza, getPlazaScope } from "../plazas/plaza-access.js";
import { tollRepository } from "./toll.repository.js";
import type { CreditDenial } from "./toll.repository.js";
import type { ProcessTollInput } from "./toll.schema.js";

type TxRow = NonNullable<Awaited<ReturnType<typeof tollRepository.findByIdempotencyKey>>>;

function isUniqueViolation(err: unknown) {
  return typeof err === "object" && err !== null && "code" in err && err.code === "P2002";
}

// Events rejected before the wallet check are not stored in the MVP (spec section 5.2),
// but they are logged so they can still be traced.
function reject(input: ProcessTollInput, status: number, code: string, message: string) {
  console.warn(`[toll] rejected ${code} rfid=${input.rfidTag} plaza=${input.plazaId}`);
  return new AppError(status, code, message);
}

interface CreditPosition {
  outstanding: string;
  limit: string;
}

function toResult(
  t: TxRow,
  balance: DecimalLike,
  idempotentReplay: boolean,
  creditPosition: CreditPosition | null = null,
) {
  return {
    transactionId: t.id,
    idempotencyKey: t.idempotencyKey,
    status: t.status,
    amount: money(t.amount),
    remainingBalance: money(balance),
    lowBalance: balance.lte(env.LOW_BALANCE_THRESHOLD),
    failureReason: t.failureReason,
    processedAt: t.processedAt,
    idempotentReplay,
    // Pay-later: set when the vehicle passed without a wallet debit. outstanding/limit are only
    // known for the request that created the toll (null on a replay).
    credit: t.onCredit
      ? {
          dueAt: t.creditDueAt,
          settled: t.settledAt !== null,
          outstanding: creditPosition?.outstanding ?? null,
          limit: creditPosition?.limit ?? null,
        }
      : null,
    vehicle: {
      id: t.vehicle.id,
      vehicleNumber: t.vehicle.vehicleNumber,
      vehicleType: t.vehicle.vehicleType,
      rfidTag: t.vehicle.rfidTag,
    },
    plaza: { id: t.plaza.id, name: t.plaza.name, code: t.plaza.code },
  };
}

// The same key must always mean the same event. A key that comes back with a different
// RFID or plaza is a client bug, so say so instead of silently returning another vehicle's toll.
async function replay(existing: TxRow, input: ProcessTollInput) {
  if (existing.vehicle.rfidTag !== input.rfidTag || existing.plazaId !== input.plazaId) {
    throw reject(
      input,
      409,
      "DUPLICATE_TRANSACTION",
      "This idempotency key was already used for a different toll event",
    );
  }
  const wallet = await tollRepository.findWalletByUserId(existing.vehicle.userId);
  if (!wallet) throw reject(input, 404, "WALLET_NOT_FOUND", "Wallet not found for this vehicle's owner");
  return toResult(existing, wallet.balance, true);
}

function failedMessage(result: ReturnType<typeof toResult>, where: string) {
  const head = `The toll of ₹${result.amount} at ${where} failed`;
  switch (result.failureReason as CreditDenial | null) {
    case "CREDIT_OVERDUE":
      return `${head}: you have overdue pay-later dues. Pay them to use pay-later again, or top up your wallet.`;
    case "CREDIT_LIMIT_EXCEEDED":
      return `${head}: your pay-later credit limit is used up. Pay your dues or top up your wallet.`;
    case "CREDIT_MONTHLY_LIMIT_EXCEEDED":
      return `${head}: your monthly pay-later limit is used up. Please top up your wallet.`;
    default:
      return `${head}: balance ₹${result.remainingBalance} is too low. Please top up.`;
  }
}

function formatDueDate(d: Date | null) {
  if (!d) return "the due date";
  return d.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: env.CREDIT_TIMEZONE,
  });
}

// Runs AFTER the transaction committed. A notification problem must never undo a toll.
async function notify(userId: string, result: ReturnType<typeof toResult>) {
  try {
    const where = `${result.plaza.name} for ${result.vehicle.vehicleNumber}`;
    if (result.status === "SUCCESS" && result.credit) {
      // Passed on credit: the wallet was NOT charged, so no "toll paid" message.
      const position =
        result.credit.outstanding && result.credit.limit
          ? ` Unpaid credit: ₹${result.credit.outstanding} of ₹${result.credit.limit}.`
          : "";
      await tollRepository.createNotifications([
        {
          userId,
          type: "CREDIT_USED",
          title: "Toll passed on credit",
          message: `₹${result.amount} at ${where} was added to your pay-later dues. Pay by ${formatDueDate(result.credit.dueAt)}.${position}`,
        },
      ]);
    } else if (result.status === "SUCCESS") {
      const rows: Parameters<typeof tollRepository.createNotifications>[0] = [
        {
          userId,
          type: "TOLL_SUCCESS",
          title: "Toll paid",
          message: `₹${result.amount} was deducted at ${where}. Balance: ₹${result.remainingBalance}.`,
        },
      ];
      if (result.lowBalance) {
        rows.push({
          userId,
          type: "LOW_BALANCE",
          title: "Low wallet balance",
          message: `Your balance is ₹${result.remainingBalance}. Top up soon to avoid failed tolls.`,
        });
      }
      await tollRepository.createNotifications(rows);
    } else {
      await tollRepository.createNotifications([
        {
          userId,
          type: "TOLL_FAILED",
          title: "Toll payment failed",
          message: failedMessage(result, where),
        },
      ]);
    }
  } catch (err) {
    console.error("[toll] notification failed (toll itself is unaffected):", err);
  }
}

export const tollService = {
  async process(input: ProcessTollInput, actor: AuthUser) {
    // 1-2. The plaza must exist, and an OPERATOR may only work at the plazas assigned to them.
    // This runs BEFORE the idempotency lookup on purpose: otherwise an operator could replay another
    // plaza's key and read back that plaza's vehicle and transaction details.
    const plaza = await tollRepository.findPlaza(input.plazaId);
    if (!plaza) throw reject(input, 404, "RESOURCE_NOT_FOUND", "Plaza not found");

    const scope = await getPlazaScope(actor);
    if (!canAccessPlaza(scope, plaza.id)) {
      console.warn(`[toll] operator=${actor.id} tried to process at unassigned plaza=${plaza.id}`);
      throw reject(input, 403, "PLAZA_NOT_ASSIGNED", "You are not assigned to this toll plaza");
    }
    // 3. Idempotency: a key we have already processed returns the stored result, no debit.
    const existing = await tollRepository.findByIdempotencyKey(input.idempotencyKey);
    if (existing) return replay(existing, input);

    // 4-5. Vehicle by RFID, must be active
    const vehicle = await tollRepository.findVehicleByRfid(input.rfidTag);
    if (!vehicle) throw reject(input, 404, "VEHICLE_NOT_FOUND", "No vehicle is registered with this RFID tag");
    if (!vehicle.isActive) throw reject(input, 409, "VEHICLE_INACTIVE", "This vehicle is inactive");

    // Plaza must exist and be active
    if (!plaza.isActive) throw reject(input, 409, "PLAZA_INACTIVE", "This toll plaza is inactive");

    // 6. Active rate for plaza + vehicle type
    const rate = await tollRepository.findActiveRate(plaza.id, vehicle.vehicleType);
    if (!rate) {
      throw reject(input, 404, "TOLL_RATE_NOT_FOUND", "No active toll rate for this vehicle type at this plaza");
    }

    const wallet = await tollRepository.findWalletByUserId(vehicle.userId);
    if (!wallet) throw reject(input, 404, "WALLET_NOT_FOUND", "Wallet not found for this vehicle's owner");

    // 7-13. Atomic debit + toll transaction + ledger row
    let outcome;
    try {
      outcome = await tollRepository.executeToll({
        idempotencyKey: input.idempotencyKey,
        vehicleId: vehicle.id,
        plazaId: plaza.id,
        rateId: rate.id,
        walletId: wallet.id,
        amount: money(rate.amount),
        // Pay-later is on only when both limits are set; the repository re-checks under a lock.
        credit:
          !wallet.creditLimit.lte(0) && !wallet.monthlyCreditLimit.lte(0)
            ? { dueAt: new Date(Date.now() + env.CREDIT_DUE_DAYS * 86_400_000), timeZone: env.CREDIT_TIMEZONE }
            : null,
      });
    } catch (err) {
      // Two identical events raced: the other one won. Its transaction committed, ours rolled
      // back completely (including our debit). Return the winner's result unchanged.
      if (isUniqueViolation(err)) {
        const winner = await tollRepository.findByIdempotencyKey(input.idempotencyKey);
        if (winner) return replay(winner, input);
      }
      throw err;
    }

    const result = toResult(outcome.transaction, outcome.balance, false, outcome.creditPosition);

    // 14. Notifications after commit
    await notify(vehicle.userId, result);

    // 15. Return transaction + remaining balance
    return result;
  },
};