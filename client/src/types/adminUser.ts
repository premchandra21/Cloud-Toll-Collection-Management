import type { Role } from './auth'

export interface AdminUser {
  id: string
  name: string
  email: string
  role: Role
  isActive: boolean
  createdAt: string
  vehicleCount: number
  walletBalance: string | null // drivers only
}