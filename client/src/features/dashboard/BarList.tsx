import { formatMoney } from '../../utils/format'

export interface BarItem {
  key: string
  label: string
  detail: string
  revenue: string
}

// Horizontal bars scaled to the largest revenue in the list. Display-only maths: the real
// amounts always stay as strings and are printed exactly as the API sent them.
export default function BarList({ items }: { items: BarItem[] }) {
  const max = Math.max(0, ...items.map((i) => Number(i.revenue)))

  return (
    <ul className="bars">
      {items.map((i) => {
        const pct = max > 0 ? (Number(i.revenue) / max) * 100 : 0
        return (
          <li key={i.key} className="bars__row">
            <div className="bars__head">
              <strong>{i.label}</strong>
              <span>{formatMoney(i.revenue)}</span>
            </div>
            <div className="bars__track">
              <div className="bars__fill" style={{ width: `${pct}%` }} />
            </div>
            <span className="muted note">{i.detail}</span>
          </li>
        )
      })}
    </ul>
  )
}