import type { DashboardRange } from '../types/dashboard'
import { endOfDayIso, startOfDayIso } from './dateRange'

export type RangePreset = 'today' | '7d' | '30d' | 'all' | 'custom'

export const PRESET_LABELS: Record<Exclude<RangePreset, 'custom'>, string> = {
  today: 'Today',
  '7d': 'Last 7 days',
  '30d': 'Last 30 days',
  all: 'All time',
}

// Local calendar date as YYYY-MM-DD, offset by a number of days from today.
function localDate(offsetDays: number): string {
  const d = new Date()
  d.setDate(d.getDate() + offsetDays)
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${mm}-${dd}`
}

export function rangeForPreset(
  preset: RangePreset,
  custom: { fromDate: string; toDate: string },
): DashboardRange {
  const today = localDate(0)
  switch (preset) {
    case 'today':
      return { from: startOfDayIso(today), to: endOfDayIso(today) }
    case '7d':
      return { from: startOfDayIso(localDate(-6)), to: endOfDayIso(today) }
    case '30d':
      return { from: startOfDayIso(localDate(-29)), to: endOfDayIso(today) }
    case 'custom':
      return {
        ...(custom.fromDate ? { from: startOfDayIso(custom.fromDate) } : {}),
        ...(custom.toDate ? { to: endOfDayIso(custom.toDate) } : {}),
      }
    default:
      return {} // all time
  }
}