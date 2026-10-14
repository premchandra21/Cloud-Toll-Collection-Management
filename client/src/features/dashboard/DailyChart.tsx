import type { DashboardSummary } from '../../types/dashboard'
import { formatMoney } from '../../utils/format'

function shortDate(day: string): string {
  const [y, m, d] = day.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
}

// Revenue per day as vertical bars. Only days that had tolls are listed.
export default function DailyChart({ days }: { days: DashboardSummary['byDay'] }) {
  const max = Math.max(0, ...days.map((d) => Number(d.revenue)))
  const labelEvery = Math.ceil(days.length / 10) // keep the x-axis readable when there are many days

  return (
    <div className="daily" role="img" aria-label="Revenue per day">
      {days.map((d, i) => {
        const pct = max > 0 ? (Number(d.revenue) / max) * 100 : 0
        return (
          <div
            key={d.day}
            className="daily__col"
            title={`${shortDate(d.day)}: ${formatMoney(d.revenue)} · ${d.transactions} tolls (${d.failed} failed)`}
          >
            <span className="daily__value">{formatMoney(d.revenue)}</span>
            <div className="daily__bar" style={{ height: `${Math.max(pct, 2)}%` }} />
            <span className="daily__label">{i % labelEvery === 0 ? shortDate(d.day) : ''}</span>
          </div>
        )
      })}
    </div>
  )
}