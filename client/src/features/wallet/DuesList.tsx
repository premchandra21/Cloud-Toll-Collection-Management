import { useState } from 'react'
import { useCreditDues, useSettleCredit } from '../../hooks/useWallet'
import type { CreditDue, SettleResult } from '../../types/wallet'
import { daysUntil, formatDate, formatDateTime, formatMoney } from '../../utils/format'
import { getErrorMessage } from '../../utils/getErrorMessage'
import { fromCents, toCents } from '../../utils/money'

interface Props {
  balance: string
  onPaid: (result: SettleResult) => void
}

// Mirrors the server: dues are paid most-urgent first and only WHOLE tolls are settled. This is a
// preview only; the server decides what is really paid.
function coverage(dues: CreditDue[], balance: string) {
  let left = toCents(balance)
  let count = 0
  let paid = 0
  for (const d of dues) {
    const cents = toCents(d.amount)
    if (cents > left) break
    left -= cents
    paid += cents
    count += 1
  }
  return { count, amount: fromCents(paid) }
}

function DueState({ due }: { due: CreditDue }) {
  if (due.overdue) return <span className="status status--fail">Overdue</span>
  if (!due.dueAt) return null
  const days = daysUntil(due.dueAt)
  if (days <= 2) {
    return (
      <span className="status status--warn">{days <= 0 ? 'Due today' : `Due in ${days} day${days === 1 ? '' : 's'}`}</span>
    )
  }
  return <span className="muted note">in {days} days</span>
}

export default function DuesList({ balance, onPaid }: Props) {
  const dues = useCreditDues()
  const settle = useSettleCredit()
  const [error, setError] = useState<string | null>(null)

  if (dues.isPending) return null
  if (dues.isError) {
    return (
      <section className="card section-gap">
        <h3>Your dues</h3>
        <div className="alert alert--error">{getErrorMessage(dues.error)}</div>
      </section>
    )
  }

  const { dues: rows, totalOutstanding } = dues.data
  if (rows.length === 0) return null

  const covered = coverage(rows, balance)
  const canPay = covered.count > 0
  const oldest = rows[0]
  const missing = fromCents(Math.max(0, toCents(oldest.amount) - toCents(balance)))

  const pay = async () => {
    setError(null)
    try {
      onPaid(await settle.mutateAsync())
    } catch (err) {
      setError(getErrorMessage(err))
    }
  }

  return (
    <section className="card section-gap">
      <div className="plaza__head">
        <div>
          <h3 className="plaza__title">Your dues</h3>
          <p className="muted">
            Tolls you passed on credit. Paying takes the money from your wallet, most urgent first.
          </p>
        </div>
        <div className="plaza__actions">
          <button type="button" className="btn" disabled={!canPay || settle.isPending} onClick={pay}>
            {settle.isPending ? 'Paying...' : 'Pay dues'}
          </button>
        </div>
      </div>

      {error && <div className="alert alert--error">{error}</div>}

      {canPay ? (
        <p className="muted note">
          Your balance of {formatMoney(balance)} covers {covered.count} of {rows.length} due
          {rows.length === 1 ? '' : 's'} ({formatMoney(covered.amount)}).
          {covered.count < rows.length && ' Top up to clear the rest in one go.'}
        </p>
      ) : (
        <div className="alert alert--warn">
          Your balance of {formatMoney(balance)} does not cover your most urgent due (
          {formatMoney(oldest.amount)}). <a href="#top-up" className="link">Top up</a> at least{' '}
          {formatMoney(missing)} more to pay it.
        </div>
      )}

      <div className="table-wrap">
        <table className="table">
          <thead>
            <tr>
              <th>Passed on</th>
              <th>Vehicle</th>
              <th>Plaza</th>
              <th>Due by</th>
              <th className="num">Amount</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((d) => (
              <tr key={d.id}>
                <td>{formatDateTime(d.processedAt)}</td>
                <td>
                  <strong>{d.vehicleNumber}</strong>
                </td>
                <td>
                  {d.plaza.name} <span className="badge">{d.plaza.code}</span>
                </td>
                <td>
                  {d.dueAt ? formatDate(d.dueAt) : '-'} <DueState due={d} />
                </td>
                <td className="num">{formatMoney(d.amount)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <th colSpan={4}>Total owed</th>
              <th className="num">{formatMoney(totalOutstanding)}</th>
            </tr>
          </tfoot>
        </table>
      </div>
    </section>
  )
}