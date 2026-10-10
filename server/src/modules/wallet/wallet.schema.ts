import { z } from "zod";
import { paginationQuerySchema } from "../../shared/utils/pagination.js";

export const MIN_TOP_UP = 1;
export const MAX_TOP_UP = 50000;

// Accepts 500, 500.5 or "500.50". Validated as a string so no float ever reaches the database.
export const topUpSchema = z.object({
  amount: z
    .union([z.string(), z.number()])
    .transform((v) => String(v).trim())
    .pipe(
      z
        .string()
        .regex(/^\d{1,6}(\.\d{1,2})?$/, "Enter a valid amount with at most 2 decimal places")
        .refine((v) => Number(v) >= MIN_TOP_UP && Number(v) <= MAX_TOP_UP, {
          message: `Top-up must be between ${MIN_TOP_UP} and ${MAX_TOP_UP}`,
        }),
    ),
});

export const ledgerQuerySchema = paginationQuerySchema.extend({
  type: z.enum(["TOP_UP", "TOLL_DEBIT", "REFUND", "ADJUSTMENT"]).optional(),
});

export type TopUpInput = z.infer<typeof topUpSchema>;
export type LedgerQuery = z.infer<typeof ledgerQuerySchema>;