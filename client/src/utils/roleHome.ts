import type { Role } from '../types/auth'

const HOME: Record<Role, string> = {
  USER: '/app',
  OPERATOR: '/operator',
  ADMIN: '/admin',
}

export function roleHome(role: Role): string {
  return HOME[role]
}