import axios from 'axios'
import type { ApiError } from '../api/axios'

export function getErrorMessage(
  err: unknown,
  fallback = 'Something went wrong. Please try again.',
): string {
  if (axios.isAxiosError<ApiError>(err)) {
    const message = err.response?.data?.error?.message
    if (message) return message
    if (!err.response) return 'Cannot reach the server. Is the API running?'
  }
  return fallback
}