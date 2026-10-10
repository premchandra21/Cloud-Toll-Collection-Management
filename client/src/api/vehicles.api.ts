import { api } from './axios'
import type { ApiSuccess } from './axios'
import type { Vehicle, VehicleType } from '../types/vehicle'

export interface CreateVehicleInput {
  vehicleNumber: string
  vehicleType: VehicleType
  rfidTag: string
}

export type UpdateVehicleInput = Partial<CreateVehicleInput & { isActive: boolean }>

export async function listVehicles(): Promise<Vehicle[]> {
  const res = await api.get<ApiSuccess<{ vehicles: Vehicle[] }>>('/vehicles')
  return res.data.data.vehicles
}

export async function createVehicle(input: CreateVehicleInput): Promise<Vehicle> {
  const res = await api.post<ApiSuccess<{ vehicle: Vehicle }>>('/vehicles', input)
  return res.data.data.vehicle
}

export async function updateVehicle(id: string, input: UpdateVehicleInput): Promise<Vehicle> {
  const res = await api.patch<ApiSuccess<{ vehicle: Vehicle }>>(`/vehicles/${id}`, input)
  return res.data.data.vehicle
}