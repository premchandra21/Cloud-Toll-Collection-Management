import { api } from './axios'
import type { ApiSuccess } from './axios'
import type { Plaza, TollRate } from '../types/plaza'
import type { VehicleType } from '../types/vehicle'

export interface CreatePlazaInput {
  name: string
  code: string
  location: string
}

export type UpdatePlazaInput = Partial<CreatePlazaInput & { isActive: boolean }>

export interface SetRateInput {
  vehicleType: VehicleType
  amount: string
}

export async function listPlazas(): Promise<Plaza[]> {
  const res = await api.get<ApiSuccess<{ plazas: Plaza[] }>>('/plazas')
  return res.data.data.plazas
}

export async function createPlaza(input: CreatePlazaInput): Promise<Plaza> {
  const res = await api.post<ApiSuccess<{ plaza: Plaza }>>('/plazas', input)
  return res.data.data.plaza
}

export async function updatePlaza(id: string, input: UpdatePlazaInput): Promise<Plaza> {
  const res = await api.patch<ApiSuccess<{ plaza: Plaza }>>(`/plazas/${id}`, input)
  return res.data.data.plaza
}

// `changed` is false when the amount equals the current active rate.
export async function setRate(
  plazaId: string,
  input: SetRateInput,
): Promise<{ rate: TollRate; changed: boolean }> {
  const res = await api.post<ApiSuccess<{ rate: TollRate; changed: boolean }>>(
    `/plazas/${plazaId}/rates`,
    input,
  )
  return res.data.data
}

export async function deactivateRate(plazaId: string, rateId: string): Promise<TollRate> {
  const res = await api.patch<ApiSuccess<{ rate: TollRate }>>(
    `/plazas/${plazaId}/rates/${rateId}`,
    { isActive: false },
  )
  return res.data.data.rate
}