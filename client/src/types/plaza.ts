import type { VehicleType } from './vehicle'

export interface TollRate {
  id: string
  plazaId: string
  vehicleType: VehicleType
  amount: string // money is always a string, e.g. "80.00"
  isActive: boolean
  createdAt: string
  updatedAt: string
}

export interface Plaza {
  id: string
  name: string
  code: string
  location: string
  isActive: boolean
  createdAt: string
  updatedAt: string
  rates: TollRate[] // ACTIVE rates only, at most one per vehicle type
}