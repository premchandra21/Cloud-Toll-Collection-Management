import { AppError } from "../../shared/errors/AppError.js";
import { toCsv } from "../../shared/utils/csv.js";
import { money } from "../../shared/utils/money.js";
import { pageMeta } from "../../shared/utils/pagination.js";
import type { AuthUser } from "../../shared/types.js";
import { transactionRepository } from "./transaction.repository.js";
import type { TransactionFilters, TransactionListQuery } from "./transaction.schema.js";

export const MAX_EXPORT_ROWS = 10_000;

type TxRow = NonNullable<Awaited<ReturnType<typeof transactionRepository.findById>>>;

// A USER only ever sees tolls of vehicles they own. Operators and admins see everything.
const scopeFor = (actor: AuthUser) => (actor.role === "USER" ? { userId: actor.id } : {});

function toDto(t: TxRow, actor: AuthUser) {
  return {
    id: t.id,
    idempotencyKey: t.idempotencyKey,
    status: t.status,
    amount: money(t.amount),
    failureReason: t.failureReason,
    processedAt: t.processedAt,
    vehicle: {
      id: t.vehicle.id,
      vehicleNumber: t.vehicle.vehicleNumber,
      vehicleType: t.vehicle.vehicleType,
      rfidTag: t.vehicle.rfidTag,
    },
    plaza: { id: t.plaza.id, name: t.plaza.name, code: t.plaza.code },
    // Driver details are only for staff; a driver already knows it is them.
    ...(actor.role !== "USER"
      ? { owner: { id: t.vehicle.user.id, name: t.vehicle.user.name, email: t.vehicle.user.email } }
      : {}),
  };
}

export const transactionService = {
  async list(query: TransactionListQuery, actor: AuthUser) {
    const { page, pageSize, ...filters } = query;
    const { rows, total } = await transactionRepository.list(filters, scopeFor(actor), {
      skip: (page - 1) * pageSize,
      take: pageSize,
    });
    return { items: rows.map((r) => toDto(r, actor)), meta: pageMeta(page, pageSize, total) };
  },

  async getById(id: string, actor: AuthUser) {
    const row = await transactionRepository.findById(id);
    // Someone else's transaction is reported as 404 so its existence is not leaked.
    if (!row || (actor.role === "USER" && row.vehicle.userId !== actor.id)) {
      throw new AppError(404, "RESOURCE_NOT_FOUND", "Transaction not found");
    }

    let balanceAfter: string | null = null;
    if (row.status === "SUCCESS") {
      const ledger = await transactionRepository.findLedgerEntry(row.id, row.vehicle.userId);
      balanceAfter = ledger ? money(ledger.balanceAfter) : null;
    }
    return { ...toDto(row, actor), balanceAfter };
  },

  async exportCsv(filters: TransactionFilters, actor: AuthUser) {
    const rows = await transactionRepository.findForExport(filters, scopeFor(actor), MAX_EXPORT_ROWS);

    return toCsv(
      [
        "Transaction ID",
        "Processed at (UTC)",
        "Status",
        "Amount (INR)",
        "Failure reason",
        "Plaza code",
        "Plaza name",
        "Vehicle number",
        "Vehicle type",
        "RFID tag",
        "Driver name",
        "Driver email",
        "Idempotency key",
      ],
      rows.map((t) => [
        t.id,
        t.processedAt,
        t.status,
        money(t.amount),
        t.failureReason,
        t.plaza.code,
        t.plaza.name,
        t.vehicle.vehicleNumber,
        t.vehicle.vehicleType,
        t.vehicle.rfidTag,
        t.vehicle.user.name,
        t.vehicle.user.email,
        t.idempotencyKey,
      ]),
    );
  },
};