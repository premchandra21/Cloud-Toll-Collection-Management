import { api } from './axios'
import type { ApiSuccess } from './axios'

export interface HealthData {
  db: string
}

export async function getHealth(): Promise<HealthData> {
  const res = await api.get<ApiSuccess<HealthData>>('/health')
  return res.data.data
}