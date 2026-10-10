import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { getLedger, getWallet, topUpWallet } from '../api/wallet.api'

export function useWallet() {
  return useQuery({ queryKey: ['wallet', 'summary'], queryFn: getWallet })
}

export function useLedger(page: number, pageSize = 10) {
  return useQuery({
    queryKey: ['wallet', 'ledger', page, pageSize],
    queryFn: () => getLedger({ page, pageSize }),
    placeholderData: keepPreviousData,
  })
}

export function useTopUp() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (amount: string) => topUpWallet(amount),
    // Refreshes both the balance card and the ledger table (shared 'wallet' prefix)
    onSuccess: () => qc.invalidateQueries({ queryKey: ['wallet'] }),
  })
}