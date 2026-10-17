import { AppError } from "../../shared/errors/AppError.js";
import { money, toCents } from "../../shared/utils/money.js";
import { pageMeta } from "../../shared/utils/pagination.js";
import type { AuthUser } from "../../shared/types.js";
import { userRepository } from "./user.repository.js";
import type {
  SetUserCreditInput,
  SetUserPlazasInput,
  UpdateUserInput,
  UserListQuery,
} from "./user.schema.js";

type UserRow = NonNullable<Awaited<ReturnType<typeof userRepository.findById>>>;

function toDto(u: UserRow, creditOutstanding: string) {
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
    // Pay-later facility (drivers only). enabled = both limits above 0. outstanding = unpaid pay-later tolls.
    credit: u.wallet
      ? {
          enabled: toCents(u.wallet.creditLimit) > 0 && toCents(u.wallet.monthlyCreditLimit) > 0,
          limit: money(u.wallet.creditLimit),
          monthlyLimit: money(u.wallet.monthlyCreditLimit),
          outstanding: creditOutstanding,
        }
      : null,
    // The plazas an operator may work at (always [] for drivers and admins)
    plazas: u.operatorPlazas.map((op) => op.plaza),
  };
}

async function toDtoWithCredit(u: UserRow) {
  const outstanding = await userRepository.creditOutstanding([u.id]);
  return toDto(u, outstanding.get(u.id) ?? "0.00");
}

export const userService = {
  async list(query: UserListQuery) {
    const { rows, total } = await userRepository.list(query, {
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
    });
    const outstanding = await userRepository.creditOutstanding(rows.map((r) => r.id));
    return {
      items: rows.map((r) => toDto(r, outstanding.get(r.id) ?? "0.00")),
      meta: pageMeta(query.page, query.pageSize, total),
    };
  },

  async update(id: string, input: UpdateUserInput, actor: AuthUser) {
    const existing = await userRepository.findById(id);
    if (!existing) throw new AppError(404, "RESOURCE_NOT_FOUND", "User not found");

    // An admin who locks themselves out could leave the system with no active admin.
    if (id === actor.id && !input.isActive) {
      throw new AppError(409, "CONFLICT", "You cannot deactivate your own account");
    }

    if (existing.isActive === input.isActive) return toDtoWithCredit(existing); // no-op

    // A deactivated user is rejected on their very next request: requireAuth re-checks isActive in the DB.
    const updated = await userRepository.setActive(id, input.isActive);
    console.warn(`[users] admin=${actor.id} set user=${id} isActive=${input.isActive}`);
    return toDtoWithCredit(updated);
  },

  // Admin sets which plazas an operator may work at. Takes effect on the operator's next request.
  async setPlazas(id: string, input: SetUserPlazasInput, actor: AuthUser) {
    const existing = await userRepository.findById(id);
    if (!existing) throw new AppError(404, "RESOURCE_NOT_FOUND", "User not found");

    // Admins already reach every plaza and drivers never use staff features, so an assignment
    // on those accounts would be meaningless (and would silently do nothing).
    if (existing.role !== "OPERATOR") {
      throw new AppError(409, "CONFLICT", "Plazas can only be assigned to operators");
    }

    if (input.plazaIds.length > 0) {
      const found = await userRepository.countPlazas(input.plazaIds);
      if (found !== input.plazaIds.length) {
        throw new AppError(404, "RESOURCE_NOT_FOUND", "One or more plazas were not found");
      }
    }

    const updated = await userRepository.replacePlazas(id, input.plazaIds);
    console.warn(`[users] admin=${actor.id} set operator=${id} plazas=[${input.plazaIds.join(",")}]`);
    return toDtoWithCredit(updated);
  },

  // Admin sets a driver's pay-later limits (both 0 = off). Affects the driver's NEXT toll only; dues
  // already taken stay payable, and lowering a limit below what is owed simply blocks new credit.
  async setCredit(id: string, input: SetUserCreditInput, actor: AuthUser) {
    const existing = await userRepository.findById(id);
    if (!existing) throw new AppError(404, "RESOURCE_NOT_FOUND", "User not found");
    if (existing.role !== "USER" || !existing.wallet) {
      throw new AppError(409, "CONFLICT", "Pay-later limits can only be set for drivers with a wallet");
    }
    const updated = await userRepository.setCreditLimits(id, input.creditLimit, input.monthlyCreditLimit);
    console.warn(
      `[users] admin=${actor.id} set user=${id} creditLimit=${input.creditLimit} monthlyCreditLimit=${input.monthlyCreditLimit}`,
    );
    return toDtoWithCredit(updated);
  },
};