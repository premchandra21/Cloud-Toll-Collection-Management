import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { listUsers, setUserActive, setUserPlazas } from '../api/users.api'
import type { UserQuery } from '../api/users.api'

export function useAdminUsers(query: UserQuery) {
  return useQuery({
    queryKey: ['admin-users', query],
    queryFn: () => listUsers(query),
    placeholderData: keepPreviousData,
  })
}

export function useSetUserActive() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) => setUserActive(id, isActive),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-users'] }),
  })
}

export function useSetUserPlazas() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, plazaIds }: { id: string; plazaIds: string[] }) => setUserPlazas(id, plazaIds),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-users'] }),
  })
}