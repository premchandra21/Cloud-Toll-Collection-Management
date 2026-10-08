import { createContext } from 'react'
import type { LoginInput, RegisterInput } from '../../api/auth.api'
import type { User } from '../../types/auth'

export interface AuthContextValue {
  user: User | null
  isLoading: boolean
  login: (input: LoginInput) => Promise<User>
  register: (input: RegisterInput) => Promise<User>
  logout: () => void
}

export const AuthContext = createContext<AuthContextValue | null>(null)