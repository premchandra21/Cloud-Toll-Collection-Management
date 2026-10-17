import { useState } from 'react'
import type { FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { downloadTransactionsCsv } from '../api/transactions.api'
import CreditBadge from '../components/ui/CreditBadge'
import Pagination from '../components/ui/Pagination'
import { useAuth } from '../features/auth/useAuth'
import PlazaFilter from '../features/transactions/PlazaFilter'
import { useTransactions } from '../hooks/useTransactions'
import type { TollStatus, TransactionFilters } from '../types/transaction'
import { VEHICLE_TYPE_LABELS } from '../types/vehicle'
import type { VehicleType } from '../types/vehicle'
import { endOfDayIso, startOfDayIso } from '../utils/dateRange'
import { failureLabel } from '../utils/failureReasons'
import { formatDateTime, formatMoney } from '../utils/format'
import { getErrorMessage } from '../utils/getErrorMessage'
import { transactionsPath } from '../utils/transactionPaths'

interface Draft {
  q: string
  status: '' | TollStatus
  plazaId: string 
  vehicleType: '' | VehicleType
  fromDate: string
  toDate: string
}

const EMPTY: Draft = { q: '', status: '', plazaId: '', vehicleType: '', fromDate: '', toDate: '' }

// Empty fields are dropped so they never reach the API.
function toFilters(d: Draft): TransactionFilters {
  return {
    ...(d.q.trim() ? { q: d.q.trim() } : {}),
    ...(d.status ? { status: d.status } : {}),
    ...(d.plazaId ? { plazaId: d.plazaId } : {}),
    ...(d.vehicleType ? { vehicleType: d.vehicleType } : {}),
    ...(d.fromDate ? { from: startOfDayIso(d.fromDate) } : {}),
    ...(d.toDate ? { to: endOfDayIso(d.toDate) } : {}),
  }
}

// One page for all three roles. A USER automatically gets only their own tolls (enforced by the API);
// staff also get the plaza filter, driver column and CSV export.
export default function TransactionsPage() {
  const { user } = useAuth()
  const isStaff = user?.role === 'OPERATOR' || user?.role === 'ADMIN'
  const base = user ? transactionsPath(user.role) : '/'

  const [draft, setDraft] = useState<Draft>(EMPTY)
  const [applied, setApplied] = useState<Draft>(EMPTY)
  const [page, setPage] = useState(1)
  const [exporting, setExporting] = useState(false)
  const [exportError, setExportError] = useState<string | null>(null)

  const filters = toFilters(applied)
  const list = useTransactions(filters, page)

  const invalidRange = Boolean(draft.fromDate && draft.toDate && draft.fromDate > draft.toDate)
  const set = <K extends keyof Draft>(key: K, value: Draft[K]) =>
    setDraft((d) => ({ ...d, [key]: value }))

  const apply = (e: FormEvent) => {
    e.preventDefault()
    if (invalidRange) return
    setApplied(draft)
    setPage(1)
  }

  const reset = () => {
    setDraft(EMPTY)
    setApplied(EMPTY)
    setPage(1)
  }

  const exportCsv = async () => {
    setExportError(null)
    setExporting(true)
    try {
      await downloadTransactionsCsv(filters)
    } catch (err) {
      setExportError(getErrorMessage(err, 'Could not export the CSV file.'))
    } finally {
      setExporting(false)
    }
  }

  return (
    <>
      <h2 className="page-title">{isStaff ? 'Transactions' : 'My toll history'}</h2>

      <section className="card">
        <form onSubmit={apply} className="form form--inline">
          <label>
            Vehicle number or RFID
            <input
              placeholder="OD02AB1234 or RFID-0001"
              value={draft.q}
              onChange={(e) => set('q', e.target.value)}
              autoComplete="off"
            />
          </label>

          <label>
            Status
            <select value={draft.status} onChange={(e) => set('status', e.target.value as Draft['status'])}>
              <option value="">All</option>
              <option value="SUCCESS">Success</option>
              <option value="FAILED">Failed</option>
            </select>
          </label>

          <label>
            Vehicle type
            <select
              value={draft.vehicleType}
              onChange={(e) => set('vehicleType', e.target.value as Draft['vehicleType'])}
            >
              <option value="">All</option>
              {Object.entries(VEHICLE_TYPE_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>

          {isStaff && <PlazaFilter value={draft.plazaId} onChange={(v) => set('plazaId', v)} />}

          <label>
            From
            <input type="date" value={draft.fromDate} onChange={(e) => set('fromDate', e.target.value)} />
          </label>

          <label>
            To
            <input type="date" value={draft.toDate} onChange={(e) => set('toDate', e.target.value)} />
          </label>

          {invalidRange && <div className="alert alert--error">The start date must not be after the end date.</div>}

          <div className="form__actions">
            <button type="submit" className="btn" disabled={invalidRange}>
              Apply filters
            </button>
            <button type="button" className="btn btn--ghost" onClick={reset}>
              Reset
            </button>
            {isStaff && (
              <button
                type="button"
                className="btn btn--ghost"
                disabled={exporting}
                onClick={exportCsv}
                title="Exports the filtered transactions (up to 10,000 rows)"
              >
                {exporting ? 'Exporting...' : 'Export CSV'}
              </button>
            )}
          </div>
        </form>
        {exportError && <div className="alert alert--error section-gap">{exportError}</div>}
      </section>

      <section className="card section-gap">
        {list.isPending && <p className="muted">Loading transactions...</p>}
        {list.isError && <div className="alert alert--error">{getErrorMessage(list.error)}</div>}
        {list.data && list.data.items.length === 0 && (
          <p className="muted">No transactions match these filters.</p>
        )}

        {list.data && list.data.items.length > 0 && (
          <>
            <p className="muted note">{list.data.meta.total} transaction(s)</p>
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Vehicle</th>
                    {isStaff && <th>Driver</th>}
                    <th>Plaza</th>
                    <th>Status</th>
                    <th className="num">Amount</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {list.data.items.map((t) => (
                    <tr key={t.id}>
                      <td>{formatDateTime(t.processedAt)}</td>
                      <td>
                        <strong>{t.vehicle.vehicleNumber}</strong>
                        <div className="muted note">{VEHICLE_TYPE_LABELS[t.vehicle.vehicleType]}</div>
                      </td>
                      {isStaff && <td>{t.owner?.name ?? '-'}</td>}
                      <td>
                        {t.plaza.name} <span className="badge">{t.plaza.code}</span>
                      </td>
                      <td>
                        {t.credit ? (
                          <CreditBadge credit={t.credit} />
                        ) : (
                          <span className={`status status--${t.status === 'SUCCESS' ? 'ok' : 'fail'}`}>
                            {t.status === 'SUCCESS' ? 'Success' : 'Failed'}
                          </span>
                        )}
                        {t.status === 'FAILED' && (
                          <div className="muted note">{failureLabel(t.failureReason)}</div>
                        )}
                      </td>
                      <td className="num">{formatMoney(t.amount)}</td>
                      <td className="table__actions">
                        <Link to={`${base}/${t.id}`} className="link">
                          Details
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pagination meta={list.data.meta} onPageChange={setPage} disabled={list.isFetching} />
          </>
        )}
      </section>
    </>
  )
}