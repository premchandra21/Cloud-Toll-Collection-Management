import { useState } from 'react'
import type { FormEvent } from 'react'
import { Link } from 'react-router-dom'
import BarList from '../features/dashboard/BarList'
import DailyChart from '../features/dashboard/DailyChart'
import { useAuth } from '../features/auth/useAuth'
import { useDashboardSummary } from '../hooks/useDashboard'
import { VEHICLE_TYPE_LABELS } from '../types/vehicle'
import { PRESET_LABELS, rangeForPreset } from '../utils/dashboardRange'
import type { RangePreset } from '../utils/dashboardRange'
import { formatMoney } from '../utils/format'
import { getErrorMessage } from '../utils/getErrorMessage'
import { transactionsPath } from '../utils/transactionPaths'

const PRESETS = Object.keys(PRESET_LABELS) as Exclude<RangePreset, 'custom'>[]

// Revenue dashboard for OPERATOR and ADMIN. Every number comes from SQL aggregations on the server.
export default function DashboardPage() {
  const { user } = useAuth()
  const [preset, setPreset] = useState<RangePreset>('30d')
  const [draft, setDraft] = useState({ fromDate: '', toDate: '' })
  const [custom, setCustom] = useState({ fromDate: '', toDate: '' })

  const invalidRange = Boolean(draft.fromDate && draft.toDate && draft.fromDate > draft.toDate)
  const summary = useDashboardSummary(rangeForPreset(preset, custom))

  const applyCustom = (e: FormEvent) => {
    e.preventDefault()
    if (invalidRange) return
    setCustom(draft)
    setPreset('custom')
  }

  const data = summary.data
  const totals = data?.totals

  return (
    <>
      <div className="plaza__head">
        <h2 className="page-title">Revenue dashboard</h2>
        {user && (
          <Link to={transactionsPath(user.role)} className="link">
            View all transactions
          </Link>
        )}
      </div>

      <section className="card">
        <div className="chips">
          {PRESETS.map((p) => (
            <button
              key={p}
              type="button"
              className={`btn btn--small ${preset === p ? '' : 'btn--ghost'}`}
              onClick={() => setPreset(p)}
            >
              {PRESET_LABELS[p]}
            </button>
          ))}
        </div>

        <form onSubmit={applyCustom} className="range-form section-gap">
          <label>
            From
            <input
              type="date"
              value={draft.fromDate}
              onChange={(e) => setDraft((d) => ({ ...d, fromDate: e.target.value }))}
            />
          </label>
          <label>
            To
            <input
              type="date"
              value={draft.toDate}
              onChange={(e) => setDraft((d) => ({ ...d, toDate: e.target.value }))}
            />
          </label>
          <button
            type="submit"
            className={`btn btn--small ${preset === 'custom' ? '' : 'btn--ghost'}`}
            disabled={invalidRange || (!draft.fromDate && !draft.toDate)}
          >
            Custom range
          </button>
        </form>
        {invalidRange && (
          <div className="alert alert--error section-gap">The start date must not be after the end date.</div>
        )}
      </section>

      {summary.isPending && <p className="muted section-gap">Loading dashboard...</p>}
      {summary.isError && (
        <div className="alert alert--error section-gap">{getErrorMessage(summary.error)}</div>
      )}

      {data && totals && (
        <>
          <section className="kpi-grid section-gap">
            <article className="card">
              <h3>Revenue collected</h3>
              <p className="stat">{formatMoney(totals.revenue)}</p>
            </article>
            <article className="card">
              <h3>Transactions</h3>
              <p className="stat">{totals.transactions}</p>
            </article>
            <article className="card">
              <h3>Successful</h3>
              <p className="stat pos">{totals.success}</p>
            </article>
            <article className="card">
              <h3>Failed</h3>
              <p className="stat neg">{totals.failed}</p>
            </article>
            <article className="card">
              <h3>Success rate</h3>
              <p className="stat">{totals.successRate === null ? '-' : `${totals.successRate}%`}</p>
            </article>
            <article className="card">
              <h3>Uncollected</h3>
              <p className="stat">{formatMoney(totals.uncollected)}</p>
              <p className="muted note">Value of failed tolls</p>
            </article>
          </section>

          {totals.transactions === 0 && (
            <div className="alert alert--warn section-gap">
              No toll transactions in this period. Process some from the toll simulator, or pick a wider range.
            </div>
          )}

          <section className="card section-gap">
            <h3>Revenue per day</h3>
            {data.byDay.length === 0 ? (
              <p className="muted">No activity in this period.</p>
            ) : (
              <DailyChart days={data.byDay} />
            )}
          </section>

          <section className="grid section-gap">
            <article className="card">
              <h3>By plaza</h3>
              <BarList
                items={data.byPlaza.map((p) => ({
                  key: p.id,
                  label: `${p.name} (${p.code})`,
                  detail: `${p.transactions} tolls · ${p.success} paid · ${p.failed} failed`,
                  revenue: p.revenue,
                }))}
              />
            </article>

            <article className="card">
              <h3>By vehicle type</h3>
              <BarList
                items={data.byVehicleType.map((v) => ({
                  key: v.vehicleType,
                  label: VEHICLE_TYPE_LABELS[v.vehicleType],
                  detail: `${v.transactions} tolls · ${v.success} paid · ${v.failed} failed`,
                  revenue: v.revenue,
                }))}
              />
            </article>
          </section>

          <p className="muted note section-gap">
            Days are grouped in your time zone ({data.range.timeZone}). Revenue counts successful tolls only.
          </p>
        </>
      )}
    </>
  )
}