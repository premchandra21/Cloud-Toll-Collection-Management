import { AppError } from "../../shared/errors/AppError.js";
import { money } from "../../shared/utils/money.js";
import { pageMeta } from "../../shared/utils/pagination.js";
import type { AuthUser } from "../../shared/types.js";
import { userRepository } from "./user.repository.js";
import type { UpdateUserInput, UserListQuery } from "./user.schema.js";

type UserRow = NonNullable<Awaited<ReturnType<typeof userRepository.findById>>>;

function toDto(u: UserRow) {
  return {
    id: u.id,
    name: u.name,
    email: u.email,
    role: u.role,
    isActive: u.isActive,
    createdAt: u.createdAt,
    vehicleCount: u._count.vehicles,
    // Only drivers have a wallet
    walletBalance: u.wallet ? money(u.wallet.balance) : null,
  };
}

export const userService = {
  async list(query: UserListQuery) {
    const { rows, total } = await userRepository.list(query, {
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
    });
    return { items: rows.map(toDto), meta: pageMeta(query.page, query.pageSize, total) };
  },

  async update(id: string, input: UpdateUserInput, actor: AuthUser) {
    const existing = await userRepository.findById(id);
    if (!existing) throw new AppError(404, "RESOURCE_NOT_FOUND", "User not found");

    // An admin who locks themselves out could leave the system with no active admin.
    if (id === actor.id && !input.isActive) {
      throw new AppError(409, "CONFLICT", "You cannot deactivate your own account");
    }

    if (existing.isActive === input.isActive) return toDto(existing); // no-op

    // A deactivated user is rejected on their very next request: requireAuth re-checks isActive in the DB.
    const updated = await userRepository.setActive(id, input.isActive);
    console.warn(`[users] admin=${actor.id} set user=${id} isActive=${input.isActive}`);
    return toDto(updated);
  },
};