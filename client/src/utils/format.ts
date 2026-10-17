// Display-only helpers. Money stays a string everywhere else in the app.
export function formatMoney(value: string): string {
  const negative = value.startsWith('-')
  const num = Number(negative ? value.slice(1) : value)
  const text = num.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  return `${negative ? '-' : ''}₹${text}`
}

export function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })
}

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-IN', { dateStyle: 'medium' })
}

// Clock reads live here (not in components) so rendering stays pure.
export function isPast(iso: string): boolean {
  return new Date(iso).getTime() < Date.now()
}

// Whole days from now until `iso` (rounded up). Negative once the date has passed.
export function daysUntil(iso: string): number {
  return Math.ceil((new Date(iso).getTime() - Date.now()) / 86_400_000)
}