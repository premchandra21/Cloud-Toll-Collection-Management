import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  createPlaza,
  deactivateRate,
  listPlazas,
  setRate,
  updatePlaza,
} from '../api/plazas.api'
import type { CreatePlazaInput, SetRateInput, UpdatePlazaInput } from '../api/plazas.api'

const KEY = ['plazas']

// Admin pages use this now; the operator toll simulator (next slice) reuses it.
export function usePlazas() {
  return useQuery({ queryKey: KEY, queryFn: listPlazas })
}

export function useCreatePlaza() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: CreatePlazaInput) => createPlaza(input),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  })
}

export function useUpdatePlaza() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdatePlazaInput }) => updatePlaza(id, input),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  })
}

export function useSetRate() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ plazaId, input }: { plazaId: string; input: SetRateInput }) =>
      setRate(plazaId, input),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  })
}

export function useDeactivateRate() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ plazaId, rateId }: { plazaId: string; rateId: string }) =>
      deactivateRate(plazaId, rateId),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  })
}