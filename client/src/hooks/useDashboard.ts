import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { getDashboardSummary } from '../api/dashboard.api'
import type { DashboardRange } from '../types/dashboard'

export function useDashboardSummary(range: DashboardRange) {
  return useQuery({
    queryKey: ['dashboard', 'summary', range],
    queryFn: () => getDashboardSummary(range),
    placeholderData: keepPreviousData,
    refetchInterval: 15000, // keeps the numbers fresh during a live demo
  })
}