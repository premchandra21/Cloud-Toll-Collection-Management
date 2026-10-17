import { useState } from 'react'
import type { FormEvent } from 'react'
import { Link } from 'react-router-dom'
import BarList from '../features/dashboard/BarList'
import DailyChart from '../features/dashboard/DailyChart'
import RevenueSplit from '../features/dashboard/RevenueSplit'
import { useAuth } from '../features/auth/useAuth'
import { useDashboardSummary } from '../hooks/useDashboard'
import { VEHICLE_TYPE_LABELS } from '../types/vehicle'
import { PRESET_LABELS, rangeForPreset } from '../utils/dashboardRange'
import type { RangePreset } from '../utils/dashboardRange'
import { formatMoney } from '../utils/format'
import { getErrorMessage } from '../utils/getErrorMessage'
import { toCents } from '../utils/money'
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
          {toCents(totals.creditOverdue) > 0 && (
            <div className="alert alert--error section-gap">
              {formatMoney(totals.creditOverdue)} of pay-later tolls is overdue. Drivers with overdue dues
              cannot pass on credit until they pay.
            </div>
          )}

          <section className="kpi-grid section-gap">
            <article className="card">
              <h3>Revenue earned</h3>
              <p className="stat">{formatMoney(totals.revenue)}</p>
              <p className="muted note">Collected + owed</p>
            </article>
            <article className="card">
              <h3>Collected</h3>
              <p className="stat pos">{formatMoney(totals.collected)}</p>
              <p className="muted note">Money actually received</p>
            </article>
            <article className="card">
              <h3>Owed</h3>
              <p className="stat credit">{formatMoney(totals.creditOutstanding)}</p>
              <p className="muted note">Pay-later, not yet paid</p>
            </article>
            <article className="card">
              <h3>Overdue</h3>
              <p className="stat neg">{formatMoney(totals.creditOverdue)}</p>
              <p className="muted note">Owed and past its due date</p>
            </article>
          </section>

          <section className="card section-gap">
            <h3>Revenue split</h3>
            <RevenueSplit
              collected={totals.collected}
              owed={totals.creditOutstanding}
              overdue={totals.creditOverdue}
            />
          </section>

          <section className="kpi-grid section-gap">
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
                  detail: `${p.transactions} tolls · ${p.success} passed · ${p.failed} failed`,
                  revenue: p.revenue,
                  owed: p.creditOutstanding,
                }))}
              />
            </article>

            <article className="card">
              <h3>By vehicle type</h3>
              <BarList
                items={data.byVehicleType.map((v) => ({
                  key: v.vehicleType,
                  label: VEHICLE_TYPE_LABELS[v.vehicleType],
                  detail: `${v.transactions} tolls · ${v.success} passed · ${v.failed} failed`,
                  revenue: v.revenue,
                }))}
              />
            </article>
          </section>

          <p className="muted note section-gap">
            Days are grouped in your time zone ({data.range.timeZone}). Revenue counts successful tolls only,
            including pay-later tolls that are still unpaid (shown in amber). Owed and overdue are the
            pay-later tolls from this period that have not been paid as of now.
          </p>
        </>
      )}
    </>
  )
}