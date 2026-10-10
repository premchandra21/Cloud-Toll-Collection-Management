export type VehicleType = 'CAR' | 'BUS' | 'TRUCK' | 'HEAVY_VEHICLE'

export const VEHICLE_TYPE_LABELS: Record<VehicleType, string> = {
  CAR: 'Car',
  BUS: 'Bus',
  TRUCK: 'Truck',
  HEAVY_VEHICLE: 'Heavy vehicle',
}

export interface Vehicle {
  id: string
  userId: string
  owner: { id: string; name: string; email: string }
  vehicleNumber: string
  vehicleType: VehicleType
  rfidTag: string
  isActive: boolean
  createdAt: string
  updatedAt: string
}