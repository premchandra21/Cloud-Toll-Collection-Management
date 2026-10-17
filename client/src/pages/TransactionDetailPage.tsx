import { Link, useParams } from 'react-router-dom'
import CreditBadge from '../components/ui/CreditBadge'
import { useAuth } from '../features/auth/useAuth'
import { useTransaction } from '../hooks/useTransactions'
import type { TollTransactionDetail } from '../types/transaction'
import { VEHICLE_TYPE_LABELS } from '../types/vehicle'
import { failureExplanation, failureLabel } from '../utils/failureReasons'
import { formatDate, formatDateTime, formatMoney, isPast } from '../utils/format'
import { getErrorMessage } from '../utils/getErrorMessage'
import { transactionsPath } from '../utils/transactionPaths'

export default function TransactionDetailPage() {
  const { id } = useParams()
  const { user } = useAuth()
  const { data: t, isPending, isError, error } = useTransaction(id)
  const backTo = user ? transactionsPath(user.role) : '/'

  return (
    <>
      <p>
        <Link to={backTo} className="link">
          ← Back to transactions
        </Link>
      </p>

      {isPending && <p className="muted">Loading transaction...</p>}
      {isError && <div className="alert alert--error">{getErrorMessage(error)}</div>}

      {t && <Detail t={t} />}
    </>
  )
}

function Detail({ t }: { t: TollTransactionDetail }) {
  const credit = t.status === 'SUCCESS' ? (t.credit ?? null) : null
  const overdue = Boolean(credit && !credit.settled && credit.dueAt && isPast(credit.dueAt))
  const tone = credit ? (overdue ? 'fail' : 'credit') : t.status === 'SUCCESS' ? 'ok' : 'fail'
  const title = credit
    ? credit.settled
      ? '✅ Pay-later toll paid'
      : '🕒 Passed on credit'
    : t.status === 'SUCCESS'
      ? '✅ Toll paid'
      : '❌ Toll failed'

  return (
    <section className={`card result result--${tone}`}>
      <h2>{title}</h2>

      {t.status === 'FAILED' && (
        <div className="alert alert--error">
          <strong>{failureLabel(t.failureReason)}.</strong> {failureExplanation(t.failureReason)}
        </div>
      )}

      {credit && !credit.settled && (
        <div className={`alert ${overdue ? 'alert--error' : 'alert--info'}`}>
          {overdue
            ? `This pay-later toll is overdue (it was due by ${credit.dueAt ? formatDate(credit.dueAt) : 'the due date'}). Nothing was taken from the wallet yet.`
            : `The vehicle passed on credit and nothing was taken from the wallet yet. It must be paid by ${credit.dueAt ? formatDate(credit.dueAt) : 'the due date'}.`}
        </div>
      )}
      {credit?.settled && credit.settledAt && (
        <div className="alert alert--ok">
          Paid from the wallet on {formatDateTime(credit.settledAt)}.
        </div>
      )}

      <dl className="result__grid">
        <div>
          <dt>Amount</dt>
          <dd>{formatMoney(t.amount)}</dd>
        </div>
        {credit && (
          <div>
            <dt>Pay later</dt>
            <dd>
              <CreditBadge credit={credit} />
            </dd>
          </div>
        )}
        <div>
          <dt>Processed at</dt>
          <dd>{formatDateTime(t.processedAt)}</dd>
        </div>
        <div>
          <dt>Plaza</dt>
          <dd>
            {t.plaza.name} ({t.plaza.code})
          </dd>
        </div>
        <div>
          <dt>Vehicle</dt>
          <dd>
            {t.vehicle.vehicleNumber} ({VEHICLE_TYPE_LABELS[t.vehicle.vehicleType]})
          </dd>
        </div>
        <div>
          <dt>RFID tag</dt>
          <dd>{t.vehicle.rfidTag}</dd>
        </div>
        {t.owner && (
          <div>
            <dt>Driver</dt>
            <dd>
              {t.owner.name} ({t.owner.email})
            </dd>
          </div>
        )}
        {t.balanceAfter !== null && (
          <div>
            <dt>{credit ? 'Wallet balance after payment' : 'Wallet balance after'}</dt>
            <dd>{formatMoney(t.balanceAfter)}</dd>
          </div>
        )}
        <div>
          <dt>Transaction ID</dt>
          <dd>{t.id}</dd>
        </div>
        <div>
          <dt>Idempotency key</dt>
          <dd>{t.idempotencyKey}</dd>
        </div>
      </dl>
    </section>
  )
}