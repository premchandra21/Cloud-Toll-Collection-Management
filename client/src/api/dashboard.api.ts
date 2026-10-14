import { api } from './axios'
import type { ApiSuccess } from './axios'
import type { DashboardRange, DashboardSummary } from '../types/dashboard'

// `tz` makes the server group tolls by the viewer's calendar days instead of UTC days.
export async function getDashboardSummary(range: DashboardRange): Promise<DashboardSummary> {
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone
  const res = await api.get<ApiSuccess<DashboardSummary>>('/dashboard/summary', {
    params: { ...range, tz },
  })
  return res.data.data
}