import { api } from './axios'
import type { ApiSuccess } from './axios'
import type { TollTransaction, TollTransactionDetail, TransactionFilters } from '../types/transaction'
import type { PageMeta } from '../types/wallet'

export interface TransactionPage {
  items: TollTransaction[]
  meta: PageMeta
}

export async function listTransactions(
  params: TransactionFilters & { page: number; pageSize: number },
): Promise<TransactionPage> {
  const res = await api.get<ApiSuccess<{ transactions: TollTransaction[] }>>('/toll-transactions', {
    params,
  })
  return { items: res.data.data.transactions, meta: res.data.meta as unknown as PageMeta }
}

export async function getTransaction(id: string): Promise<TollTransactionDetail> {
  const res = await api.get<ApiSuccess<{ transaction: TollTransactionDetail }>>(
    `/toll-transactions/${id}`,
  )
  return res.data.data.transaction
}

// A plain link cannot send the Authorization header, so the CSV is fetched with axios and then
// saved through a temporary object URL.
export async function downloadTransactionsCsv(filters: TransactionFilters): Promise<void> {
  const res = await api.get<string>('/toll-transactions/export', {
    params: filters,
    headers: { Accept: 'text/csv' },
  })
  // The server's BOM is stripped while decoding, so add it back for Excel.
  const blob = new Blob(['\uFEFF', res.data], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `toll-transactions-${new Date().toISOString().slice(0, 10)}.csv`
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}