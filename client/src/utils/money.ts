// Display-side money maths in integer cents, so no float ever touches an amount.
// Amounts arrive from the API as strings such as "80.00".
export function toCents(value: string): number {
  const negative = value.startsWith('-')
  const [whole = '0', frac = ''] = (negative ? value.slice(1) : value).split('.')
  const cents = Number(whole) * 100 + Number((frac + '00').slice(0, 2))
  return negative ? -cents : cents
}

export function fromCents(cents: number): string {
  const abs = Math.abs(cents)
  const text = `${Math.floor(abs / 100)}.${String(abs % 100).padStart(2, '0')}`
  return cents < 0 ? `-${text}` : text
}

// 0-100 for a progress bar. A zero or missing total is 0%, never NaN.
export function percentOf(part: string, total: string): number {
  const t = toCents(total)
  if (t <= 0) return 0
  return Math.max(0, Math.min(100, Math.round((toCents(part) / t) * 100)))
}