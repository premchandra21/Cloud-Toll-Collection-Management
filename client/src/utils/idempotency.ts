// One key per toll EVENT. Sending the same key again must never charge twice.
export function newIdempotencyKey(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID()
  return `evt-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
}