import { useCallback, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { fetchMe, loginRequest, registerRequest } from '../../api/auth.api'
import type { LoginInput, RegisterInput } from '../../api/auth.api'
import { queryClient } from '../../app/queryClient'
import type { User } from '../../types/auth'
import { tokenStorage } from '../../utils/tokenStorage'
import { AuthContext } from './auth-context'
import type { AuthContextValue } from './auth-context'

export default function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  // Only "loading" if there is a stored token we still need to verify
  const [isLoading, setIsLoading] = useState<boolean>(() => Boolean(tokenStorage.get()))

  // Restore the session on page load
  useEffect(() => {
    if (!tokenStorage.get()) return
    let cancelled = false
    fetchMe()
      .then((u) => {
        if (!cancelled) setUser(u)
      })
      .catch(() => {
        tokenStorage.clear()
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  const login = useCallback(async (input: LoginInput) => {
    const result = await loginRequest(input)
    tokenStorage.set(result.token)
    setUser(result.user)
    return result.user
  }, [])

  const register = useCallback(async (input: RegisterInput) => {
    const result = await registerRequest(input)
    tokenStorage.set(result.token)
    setUser(result.user)
    return result.user
  }, [])

  const logout = useCallback(() => {
    tokenStorage.clear()
    setUser(null)
    queryClient.clear()
  }, [])

  const value = useMemo<AuthContextValue>(
    () => ({ user, isLoading, login, register, logout }),
    [user, isLoading, login, register, logout],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}