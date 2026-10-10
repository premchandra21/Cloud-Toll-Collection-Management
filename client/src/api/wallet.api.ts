import { api } from './axios'
import type { ApiSuccess } from './axios'
import type { LedgerEntry, LedgerType, PageMeta, WalletSummary } from '../types/wallet'

export interface LedgerPage {
  items: LedgerEntry[]
  meta: PageMeta
}

export async function getWallet(): Promise<WalletSummary> {
  const res = await api.get<ApiSuccess<{ wallet: WalletSummary }>>('/wallet')
  return res.data.data.wallet
}

export async function topUpWallet(amount: string) {
  const res = await api.post<ApiSuccess<{ balance: string; transaction: LedgerEntry }>>(
    '/wallet/top-up',
    { amount },
  )
  return res.data.data
}

export async function getLedger(params: {
  page: number
  pageSize: number
  type?: LedgerType
}): Promise<LedgerPage> {
  const res = await api.get<ApiSuccess<{ transactions: LedgerEntry[] }>>('/wallet/transactions', {
    params,
  })
  return { items: res.data.data.transactions, meta: res.data.meta as unknown as PageMeta }
}