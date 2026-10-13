import { Link, useParams } from 'react-router-dom'
import { useAuth } from '../features/auth/useAuth'
import { useTransaction } from '../hooks/useTransactions'
import { VEHICLE_TYPE_LABELS } from '../types/vehicle'
import { formatDateTime, formatMoney } from '../utils/format'
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

      {t && (
        <section className={`card result ${t.status === 'SUCCESS' ? 'result--ok' : 'result--fail'}`}>
          <h2>{t.status === 'SUCCESS' ? '✅ Toll paid' : '❌ Toll failed'}</h2>

          {t.status === 'FAILED' && (
            <div className="alert alert--error">
              {t.failureReason === 'INSUFFICIENT_BALANCE'
                ? 'The wallet balance was too low, so nothing was deducted.'
                : (t.failureReason ?? 'The toll could not be collected.')}
            </div>
          )}

          <dl className="result__grid">
            <div>
              <dt>Amount</dt>
              <dd>{formatMoney(t.amount)}</dd>
            </div>
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
                <dt>Wallet balance after</dt>
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
      )}
    </>
  )
}