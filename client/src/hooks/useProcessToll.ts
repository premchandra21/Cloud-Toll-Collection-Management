import { useMutation } from '@tanstack/react-query'
import { processToll } from '../api/toll.api'
import type { ProcessTollInput } from '../types/toll'

export function useProcessToll() {
  return useMutation({ mutationFn: (input: ProcessTollInput) => processToll(input) })
}