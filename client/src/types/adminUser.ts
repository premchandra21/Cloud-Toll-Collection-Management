import type { Role } from './auth'

export interface UserPlaza {
  id: string
  name: string
  code: string
}

export interface AdminUser {
  id: string
  name: string
  email: string
  role: Role
  isActive: boolean
  createdAt: string
  vehicleCount: number
  walletBalance: string | null // drivers only
  credit: UserCredit | null // drivers only
  plazas: UserPlaza[] // operators only: the plazas they may work at (empty for everyone else)
}

export interface UserCredit {
  enabled: boolean
  limit: string
  monthlyLimit: string
  outstanding: string
}