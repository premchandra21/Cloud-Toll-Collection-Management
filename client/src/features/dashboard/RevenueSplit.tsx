import { formatMoney } from '../../utils/format'
import { fromCents, toCents } from '../../utils/money'

interface Props {
  collected: string
  owed: string // pay-later tolls still unpaid (includes the overdue part)
  overdue: string
}

// Where the earned revenue stands: money received, money owed but not yet due, money owed and late.
// Segment sizes are display-only maths on integer cents; the amounts printed are exact.
export default function RevenueSplit({ collected, owed, overdue }: Props) {
  const collectedC = toCents(collected)
  const overdueC = toCents(overdue)
  const notDueC = Math.max(0, toCents(owed) - overdueC)
  const total = collectedC + notDueC + overdueC

  const pct = (c: number) => (total > 0 ? (c / total) * 100 : 0)
  const parts = [
    { key: 'collected', label: 'Collected', hint: 'Received in cash or settled', cents: collectedC },
    { key: 'owed', label: 'Owed, not yet due', hint: 'Pay-later, within the due date', cents: notDueC },
    { key: 'overdue', label: 'Overdue', hint: 'Pay-later, past the due date', cents: overdueC },
  ]

  if (total === 0) return <p className="muted">No revenue in this period yet.</p>

  return (
    <>
      <div className="split" role="img" aria-label="Revenue split between collected, owed and overdue">
        {parts.map((p) =>
          p.cents > 0 ? (
            <div
              key={p.key}
              className={`split__seg split__seg--${p.key}`}
              style={{ width: `${pct(p.cents)}%` }}
              title={`${p.label}: ${formatMoney(fromCents(p.cents))}`}
            />
          ) : null,
        )}
      </div>
      <ul className="split__legend">
        {parts.map((p) => (
          <li key={p.key}>
            <span className={`split__dot split__seg--${p.key}`} aria-hidden="true" />
            <div>
              <strong>{p.label}</strong> {formatMoney(fromCents(p.cents))}{' '}
              <span className="muted">({Math.round(pct(p.cents))}%)</span>
              <div className="muted note">{p.hint}</div>
            </div>
          </li>
        ))}
      </ul>
    </>
  )
}