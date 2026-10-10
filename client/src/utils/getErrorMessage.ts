import axios from 'axios'
import type { ApiError } from '../api/axios'

export function getErrorMessage(
  err: unknown,
  fallback = 'Something went wrong. Please try again.',
): string {
  if (axios.isAxiosError<ApiError>(err)) {
    const error = err.response?.data?.error

    // Zod validation failures: show the field messages instead of a generic line
    if (error?.code === 'VALIDATION_ERROR' && Array.isArray(error.details)) {
      const parts = (error.details as { message?: unknown }[])
        .map((d) => (typeof d.message === 'string' ? d.message : null))
        .filter((m): m is string => Boolean(m))
      if (parts.length > 0) return parts.join('. ')
    }

    if (error?.message) return error.message
    if (!err.response) return 'Cannot reach the server. Is the API running?'
  }
  return fallback
}