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

export interface WalletSummary {
  // ...existing fields...
  ledgerEntries: number
  credit: CreditSummary // pay-later position (enabled: false when the admin has not switched it on)
}

export interface CreditSummary {
  enabled: boolean // both limits above 0
  limit: string // max unpaid credit at any moment
  monthlyLimit: string // max credit taken in one calendar month
  outstanding: string // unpaid pay-later tolls
  usedThisMonth: string // credit taken this calendar month (paid or not)
  available: string // how much more credit could be taken right now (0 while anything is overdue)
  hasOverdue: boolean
  overdueAmount: string
  overdueCount: number
  nextDueAt: string | null
  dueDays: number
}

export interface CreditDue {
  id: string
  amount: string
  processedAt: string
  dueAt: string | null
  overdue: boolean
  plaza: { name: string; code: string }
  vehicleNumber: string
}

export interface CreditDues {
  dues: CreditDue[] // most urgent first (the order "Pay dues" settles them in)
  totalOutstanding: string
}

export interface SettleResult {
  settledCount: number
  settledAmount: string
  balance: string
  remaining: { count: number; amount: string }
  settled: { id: string; amount: string; plaza: string; vehicleNumber: string }[]
}