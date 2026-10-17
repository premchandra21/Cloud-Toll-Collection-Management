import { Link } from 'react-router-dom'
import { useVehicles } from '../../hooks/useVehicles'
import { useWallet } from '../../hooks/useWallet'
import { useTransactions } from '../../hooks/useTransactions'
import { useAuth } from '../../features/auth/useAuth'
import CreditBadge from '../../components/ui/CreditBadge'
import { formatDate, formatDateTime, formatMoney } from '../../utils/format'
import { toCents } from '../../utils/money'

const NO_FILTERS = {}

export default function UserDashboardPage() {
  const { user } = useAuth()
  const wallet = useWallet()
  const vehicles = useVehicles()
  const recent = useTransactions(NO_FILTERS, 1, 5)

  const activeCount = vehicles.data?.filter((v) => v.isActive).length ?? 0
  const credit = wallet.data?.credit
  const showCredit = credit && (credit.enabled || toCents(credit.outstanding) > 0)

  return (
    <>
      <h2 className="page-title">Welcome, {user?.name}</h2>

      {wallet.data?.lowBalance && (
        <div className="alert alert--warn">
          Low balance: {formatMoney(wallet.data.balance)} left.{' '}
          <Link to="/app/wallet" className="link">
            Top up now
          </Link>
        </div>
      )}

      {credit?.hasOverdue && (
        <div className="alert alert--error">
          {formatMoney(credit.overdueAmount)} of pay-later tolls is overdue.{' '}
          <Link to="/app/wallet" className="link">
            Pay dues now
          </Link>
        </div>
      )}

      <section className="grid section-gap">
        <article className="card">
          <h3>Wallet balance</h3>
          <p className="stat">{wallet.data ? formatMoney(wallet.data.balance) : '...'}</p>
          <Link to="/app/wallet" className="link">
            Top up or view history
          </Link>
        </article>

        {showCredit && (
          <article className="card">
            <h3>Pay later</h3>
            <p className="stat">{formatMoney(credit.outstanding)}</p>
            <p className="muted note">
              owed
              {credit.nextDueAt ? `, next due by ${formatDate(credit.nextDueAt)}` : ''}
              {credit.enabled ? ` · ${formatMoney(credit.available)} available` : ''}
            </p>
            <Link to="/app/wallet" className="link">
              {toCents(credit.outstanding) > 0 ? 'Pay dues' : 'View pay later'}
            </Link>
          </article>
        )}

        <article className="card">
          <h3>Active vehicles</h3>
          <p className="stat">{vehicles.data ? activeCount : '...'}</p>
          <Link to="/app/vehicles" className="link">
            Manage vehicles
          </Link>
        </article>
      </section>

      <section className="card section-gap">
        <h3>Recent tolls</h3>
        {recent.isPending && <p className="muted">Loading...</p>}
        {recent.data && recent.data.items.length === 0 && (
          <p className="muted">No tolls yet. They will appear here after a vehicle passes a plaza.</p>
        )}
        {recent.data && recent.data.items.length > 0 && (
          <>
            <div className="table-wrap">
              <table className="table">
                <tbody>
                  {recent.data.items.map((t) => (
                    <tr key={t.id}>
                      <td>{formatDateTime(t.processedAt)}</td>
                      <td>
                        <strong>{t.vehicle.vehicleNumber}</strong> · {t.plaza.name}
                      </td>
                      <td>
                        {t.credit ? (
                          <CreditBadge credit={t.credit} />
                        ) : (
                          <span className={`status status--${t.status === 'SUCCESS' ? 'ok' : 'fail'}`}>
                            {t.status === 'SUCCESS' ? 'Success' : 'Failed'}
                          </span>
                        )}
                      </td>
                      <td className="num">{formatMoney(t.amount)}</td>
                      <td className="table__actions">
                        <Link to={`/app/transactions/${t.id}`} className="link">
                          Details
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="section-gap">
              <Link to="/app/transactions" className="link">
                View all toll history
              </Link>
            </p>
          </>
        )}
      </section>
    </>
  )
}