// Why a toll event was stored as FAILED. The server writes one of these codes into failureReason.
export const FAILURE_LABELS: Record<string, string> = {
  INSUFFICIENT_BALANCE: 'Insufficient balance',
  CREDIT_OVERDUE: 'Pay-later dues overdue',
  CREDIT_LIMIT_EXCEEDED: 'Pay-later limit used up',
  CREDIT_MONTHLY_LIMIT_EXCEEDED: 'Monthly pay-later limit used up',
}

// Short label for badges and logs. Unknown codes are shown as sent, so a new backend code never hides.
export function failureLabel(reason: string | null): string {
  if (!reason) return 'Failed'
  return FAILURE_LABELS[reason] ?? reason
}

// One-sentence explanation. Every FAILED toll left the wallet untouched.
export function failureExplanation(reason: string | null): string {
  switch (reason) {
    case 'INSUFFICIENT_BALANCE':
      return 'The wallet balance was too low and pay-later is not available, so the toll was not collected and nothing was deducted.'
    case 'CREDIT_OVERDUE':
      return 'The wallet balance was too low and the driver has overdue pay-later dues, so credit is blocked until they are paid. Nothing was deducted.'
    case 'CREDIT_LIMIT_EXCEEDED':
      return 'The wallet balance was too low and this toll would push unpaid pay-later credit over the driver’s credit limit. Nothing was deducted.'
    case 'CREDIT_MONTHLY_LIMIT_EXCEEDED':
      return 'The wallet balance was too low and this toll would push this month’s pay-later credit over the monthly limit. Nothing was deducted.'
    default:
      return reason ?? 'The toll could not be collected.'
  }
}