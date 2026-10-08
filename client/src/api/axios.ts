import axios from 'axios'
import { tokenStorage } from '../utils/tokenStorage'

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL ?? 'http://localhost:4000/api/v1',
  timeout: 15000,
})

// Attach the JWT to every request
api.interceptors.request.use((config) => {
  const token = tokenStorage.get()
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

// Invalid/expired token -> clear it and send the user to login (spec Section 7)
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (axios.isAxiosError(error) && error.response?.status === 401) {
      const isLoginCall = error.config?.url?.includes('/auth/login')
      if (!isLoginCall && tokenStorage.get()) {
        tokenStorage.clear()
        const path = window.location.pathname
        if (path !== '/login' && path !== '/register') {
          window.location.assign('/login')
        }
      }
    }
    return Promise.reject(error)
  },
)

// Standard response shapes from the spec (Section 8.1)
export interface ApiSuccess<T> {
  success: true
  message: string
  data: T
  meta?: Record<string, unknown>
}

export interface ApiError {
  success: false
  error: {
    code: string
    message: string
    details?: unknown
    requestId?: string
  }
}