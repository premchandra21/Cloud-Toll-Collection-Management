import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { createVehicle, listVehicles, updateVehicle } from '../api/vehicles.api'
import type { CreateVehicleInput, UpdateVehicleInput } from '../api/vehicles.api'

const KEY = ['vehicles']

export function useVehicles() {
  return useQuery({ queryKey: KEY, queryFn: listVehicles })
}

export function useCreateVehicle() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: CreateVehicleInput) => createVehicle(input),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  })
}

export function useUpdateVehicle() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdateVehicleInput }) =>
      updateVehicle(id, input),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  })
}