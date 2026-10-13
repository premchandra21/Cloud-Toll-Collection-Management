import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { getTransaction, listTransactions } from '../api/transactions.api'
import type { TransactionFilters } from '../types/transaction'

export function useTransactions(filters: TransactionFilters, page: number, pageSize = 10) {
  return useQuery({
    queryKey: ['transactions', 'list', filters, page, pageSize],
    queryFn: () => listTransactions({ ...filters, page, pageSize }),
    placeholderData: keepPreviousData,
  })
}

export function useTransaction(id: string | undefined) {
  return useQuery({
    queryKey: ['transactions', 'detail', id],
    queryFn: () => getTransaction(id!),
    enabled: Boolean(id),
  })
}