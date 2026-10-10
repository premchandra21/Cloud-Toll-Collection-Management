export type LedgerType = 'TOP_UP' | 'TOLL_DEBIT' | 'REFUND' | 'ADJUSTMENT'

// All money values arrive as strings such as "80.00" (never floats).
export interface WalletSummary {
  balance: string
  updatedAt: string
  lowBalance: boolean
  lowBalanceThreshold: string
  totalToppedUp: string
  totalSpentOnTolls: string
  ledgerEntries: number
}

export interface LedgerEntry {
  id: string
  type: LedgerType
  amount: string // signed: credits positive, debits negative
  balanceAfter: string
  referenceType: string | null
  referenceId: string | null
  description: string | null
  createdAt: string
}

export interface PageMeta {
  page: number
  pageSize: number
  total: number
  totalPages: number
}