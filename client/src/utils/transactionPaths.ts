import type { Role } from '../types/auth'

// Each role browses transactions under its own section, so the navbar highlight stays correct.
const BASE: Record<Role, string> = {
  USER: '/app/transactions',
  OPERATOR: '/operator/transactions',
  ADMIN: '/admin/transactions',
}

export function transactionsPath(role: Role): string {
  return BASE[role]
}