import { api } from './axios'
import type { ApiSuccess } from './axios'
import type { ProcessTollInput, ProcessTollResult } from '../types/toll'

// 201 = new transaction (SUCCESS or FAILED), 200 = duplicate event. Both resolve normally;
// rejected events (unknown RFID, inactive plaza, ...) throw and are handled by the caller.
export async function processToll(input: ProcessTollInput): Promise<ProcessTollResult> {
  const res = await api.post<ApiSuccess<ProcessTollResult>>('/toll-transactions/process', input)
  return res.data.data
}