import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { getCreditDues, getLedger, getWallet, settleCredit, topUpWallet } from '../api/wallet.api'

// Polled so a toll processed in another browser (the operator's) shows up without a refresh.
const POLL_MS = 20000

export function useWallet() {
  return useQuery({ queryKey: ['wallet', 'summary'], queryFn: getWallet, refetchInterval: POLL_MS })
}

export function useCreditDues() {
  return useQuery({
    queryKey: ['wallet', 'dues'],
    queryFn: getCreditDues,
    refetchInterval: POLL_MS,
  })
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
    // Refreshes the balance card, the dues list and the ledger table (shared 'wallet' prefix)
    onSuccess: () => qc.invalidateQueries({ queryKey: ['wallet'] }),
  })
}

export function useSettleCredit() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: settleCredit,
    // Paying changes the balance, the dues, the ledger, the toll list (paid/unpaid badge) and adds a
    // CREDIT_SETTLED notification, so refresh all of them.
    onSuccess: () =>
      Promise.all([
        qc.invalidateQueries({ queryKey: ['wallet'] }),
        qc.invalidateQueries({ queryKey: ['transactions'] }),
        qc.invalidateQueries({ queryKey: ['notifications'] }),
      ]),
  })
}