import { z } from "zod";
import { paginationQuerySchema } from "../../shared/utils/pagination.js";
import { optionalQuery, queryBoolean } from "../../shared/utils/query.js";

export const userListQuerySchema = paginationQuerySchema.extend({
  role: optionalQuery(z.enum(["USER", "OPERATOR", "ADMIN"])),
  isActive: optionalQuery(queryBoolean),
  // Matches name or email (partial, case-insensitive)
  q: optionalQuery(z.string().trim().min(1).max(100)),
});

// Only activation is editable in the MVP (roles come from the seed script).
export const updateUserSchema = z.object({ isActive: z.boolean() });

// The full set of plazas an operator may work at. [] removes every assignment.
// Duplicates are dropped, so the same id sent twice is harmless.
export const setUserPlazasSchema = z.object({
  plazaIds: z
    .array(z.uuid())
    .max(200, "Too many plazas")
    .transform((ids) => [...new Set(ids)]),
});

export const MAX_CREDIT_LIMIT = 100000;

// "300", 300.5 or "300.50" as a string so no float reaches the database.
const creditAmount = z
  .union([z.string(), z.number()])
  .transform((v) => String(v).trim())
  .pipe(
    z
      .string()
      .regex(/^\d{1,6}(\.\d{1,2})?$/, "Enter a valid amount with at most 2 decimal places")
      .refine((v) => Number(v) <= MAX_CREDIT_LIMIT, { message: `Limit cannot exceed ${MAX_CREDIT_LIMIT}` }),
  );

// Pay-later is ON only when BOTH limits are above 0 and OFF when both are 0.
// One of them being 0 would silently mean "off", so it is rejected instead.
export const setUserCreditSchema = z
  .object({ creditLimit: creditAmount, monthlyCreditLimit: creditAmount })
  .refine((v) => (Number(v.creditLimit) === 0) === (Number(v.monthlyCreditLimit) === 0), {
    message: "Set both limits above 0 to turn pay-later on, or both to 0 to turn it off",
    path: ["monthlyCreditLimit"],
  });

export const userIdParamsSchema = z.object({ id: z.uuid() });

export type UserListQuery = z.infer<typeof userListQuerySchema>;
export type SetUserPlazasInput = z.infer<typeof setUserPlazasSchema>;
export type UpdateUserInput = z.infer<typeof updateUserSchema>;
export type SetUserCreditInput = z.infer<typeof setUserCreditSchema>;