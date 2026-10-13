import axios from 'axios'
import type { ApiError } from '../api/axios'

// The machine-readable code from the API error body, e.g. VEHICLE_NOT_FOUND.
export function getErrorCode(err: unknown): string | null {
  if (axios.isAxiosError<ApiError>(err)) return err.response?.data?.error?.code ?? null
  return null
}