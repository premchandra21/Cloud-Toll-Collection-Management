import type { VehicleType } from './vehicle'

export interface ProcessTollInput {
  rfidTag: string
  plazaId: string
  idempotencyKey: string
}

export interface ProcessTollResult {
  transactionId: string
  idempotencyKey: string
  status: 'SUCCESS' | 'FAILED'
  amount: string // "80.00"
  remainingBalance: string
  lowBalance: boolean
  failureReason: string | null
  processedAt: string
  idempotentReplay: boolean // true = duplicate event, nothing was charged again
  credit: {
    dueAt: string | null
    settled: boolean
    outstanding: string | null // only known for the request that created the toll
    limit: string | null
  } | null
  vehicle: { id: string; vehicleNumber: string; vehicleType: VehicleType; rfidTag: string }
  plaza: { id: string; name: string; code: string }
}