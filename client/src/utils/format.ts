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