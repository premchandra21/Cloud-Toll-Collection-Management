import { api } from './axios'
import type { ApiSuccess } from './axios'
import type { AuthResult, User } from '../types/auth'

export interface LoginInput {
  email: string
  password: string
}

export interface RegisterInput {
  name: string
  email: string
  password: string
}

export async function loginRequest(input: LoginInput): Promise<AuthResult> {
  const res = await api.post<ApiSuccess<AuthResult>>('/auth/login', input)
  return res.data.data
}

export async function registerRequest(input: RegisterInput): Promise<AuthResult> {
  const res = await api.post<ApiSuccess<AuthResult>>('/auth/register', input)
  return res.data.data
}

export async function fetchMe(): Promise<User> {
  const res = await api.get<ApiSuccess<{ user: User }>>('/auth/me')
  return res.data.data.user
}