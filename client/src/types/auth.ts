export type Role = 'USER' | 'OPERATOR' | 'ADMIN'

export interface User {
  id: string
  name: string
  email: string
  role: Role
  isActive: boolean
  createdAt: string
}

export interface AuthResult {
  user: User
  token: string
}