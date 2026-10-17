import type { VehicleType } from './vehicle'

export type TollStatus = 'SUCCESS' | 'FAILED'

export interface TollTransaction {
  id: string
  idempotencyKey: string
  status: TollStatus
  amount: string // "80.00"
  failureReason: string | null
  processedAt: string
  vehicle: { id: string; vehicleNumber: string; vehicleType: VehicleType; rfidTag: string }
  plaza: { id: string; name: string; code: string }
  owner?: { id: string; name: string; email: string } // staff only
  credit?: { dueAt: string | null; settled: boolean; settledAt: string | null } | null
}

export interface TollTransactionDetail extends TollTransaction {
  balanceAfter: string | null // wallet balance right after a SUCCESS toll
}

// `from` is inclusive and `to` is exclusive, both full ISO timestamps.
export interface TransactionFilters {
  q?: string
  status?: TollStatus
  plazaId?: string
  vehicleType?: VehicleType
  from?: string
  to?: string
}