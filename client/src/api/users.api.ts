import { api } from './axios'
import type { ApiSuccess } from './axios'
import type { AdminUser } from '../types/adminUser'
import type { Role } from '../types/auth'
import type { PageMeta } from '../types/wallet'

export interface UserPage {
  items: AdminUser[]
  meta: PageMeta
}

export interface UserQuery {
  page: number
  pageSize: number
  q?: string
  role?: Role
}

export async function listUsers(params: UserQuery): Promise<UserPage> {
  const res = await api.get<ApiSuccess<{ users: AdminUser[] }>>('/users', { params })
  return { items: res.data.data.users, meta: res.data.meta as unknown as PageMeta }
}

export async function setUserActive(id: string, isActive: boolean): Promise<AdminUser> {
  const res = await api.patch<ApiSuccess<{ user: AdminUser }>>(`/users/${id}`, { isActive })
  return res.data.data.user
}