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

export const userIdParamsSchema = z.object({ id: z.uuid() });

export type UserListQuery = z.infer<typeof userListQuerySchema>;
export type SetUserPlazasInput = z.infer<typeof setUserPlazasSchema>;
export type UpdateUserInput = z.infer<typeof updateUserSchema>;