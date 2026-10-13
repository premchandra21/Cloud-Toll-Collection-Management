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

export const userIdParamsSchema = z.object({ id: z.uuid() });

export type UserListQuery = z.infer<typeof userListQuerySchema>;
export type UpdateUserInput = z.infer<typeof updateUserSchema>;