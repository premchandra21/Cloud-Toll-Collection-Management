import { z } from "zod";
import { paginationQuerySchema } from "../../shared/utils/pagination.js";
import { optionalQuery } from "../../shared/utils/query.js";
import { VEHICLE_TYPES } from "../vehicles/vehicle.schema.js";

// The client sends full ISO timestamps (computed from the user's local dates), so "today" means
// today in the user's timezone, not the server's. `from` is inclusive, `to` is EXCLUSIVE.
const isoDateTime = z.iso.datetime({ offset: true }).transform((v) => new Date(v));

const filterShape = {
  status: optionalQuery(z.enum(["SUCCESS", "FAILED"])),
  plazaId: optionalQuery(z.uuid()),
  vehicleType: optionalQuery(z.enum(VEHICLE_TYPES)),
  // Matches vehicle number or RFID tag (partial, case-insensitive)
  q: optionalQuery(z.string().trim().min(1).max(64)),
  from: optionalQuery(isoDateTime),
  to: optionalQuery(isoDateTime),
};

const fromBeforeTo = (d: { from?: Date; to?: Date }) => !d.from || !d.to || d.from < d.to;
const fromBeforeToIssue = { message: "'from' must be earlier than 'to'", path: ["from"] };

export const transactionFiltersSchema = z.object(filterShape).refine(fromBeforeTo, fromBeforeToIssue);

export const transactionListQuerySchema = paginationQuerySchema
  .extend(filterShape)
  .refine(fromBeforeTo, fromBeforeToIssue);

export const transactionIdParamsSchema = z.object({ id: z.uuid() });

export type TransactionFilters = z.infer<typeof transactionFiltersSchema>;
export type TransactionListQuery = z.infer<typeof transactionListQuerySchema>;