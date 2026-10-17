import { formatMoney } from '../../utils/format'
import { fromCents, toCents } from '../../utils/money'

export interface BarItem {
  key: string
  label: string
  detail: string
  revenue: string
  owed?: string // part of the revenue that is pay-later and still unpaid (drawn as an amber segment)
}

// Horizontal bars scaled to the largest revenue in the list. Display-only maths: the real
// amounts always stay as strings and are printed exactly as the API sent them.
export default function BarList({ items }: { items: BarItem[] }) {
  const max = Math.max(0, ...items.map((i) => Number(i.revenue)))

  return (
    <ul className="bars">
      {items.map((i) => {
        const pct = max > 0 ? (Number(i.revenue) / max) * 100 : 0
        // The owed part is carved out of the bar, so the bar's total length is still the revenue.
        const revenueC = toCents(i.revenue)
        const owedC = Math.min(revenueC, toCents(i.owed ?? '0'))
        const owedPct = revenueC > 0 ? (owedC / revenueC) * pct : 0
        return (
          <li key={i.key} className="bars__row">
            <div className="bars__head">
              <strong>{i.label}</strong>
              <span>{formatMoney(i.revenue)}</span>
            </div>
            <div className="bars__track">
              <div className="bars__fill" style={{ width: `${pct - owedPct}%` }} />
              {owedC > 0 && (
                <div
                  className="bars__fill bars__fill--owed"
                  style={{ width: `${owedPct}%` }}
                  title={`Owed (pay-later, unpaid): ${formatMoney(fromCents(owedC))}`}
                />
              )}
            </div>
            <span className="muted note">{i.detail}</span>
          </li>
        )
      })}
    </ul>
  )
}