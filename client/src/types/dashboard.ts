import type { VehicleType } from './vehicle'

// Money is always a string ("160.00"). Counts are plain numbers.
export interface Counts {
  transactions: number
  success: number
  failed: number
  revenue: string
}

export interface DashboardSummary {
  range: { from: string | null; to: string | null; timeZone: string }
  totals: Counts & {
    uncollected: string // sum of failed toll amounts
    successRate: number | null // 0-100, null when there was no traffic
  }
  byPlaza: (Counts & { id: string; name: string; code: string })[]
  byVehicleType: (Counts & { vehicleType: VehicleType })[]
  byDay: (Counts & { day: string })[] // YYYY-MM-DD, oldest first
}

export interface DashboardRange {
  from?: string // inclusive ISO timestamp
  to?: string // exclusive ISO timestamp
}