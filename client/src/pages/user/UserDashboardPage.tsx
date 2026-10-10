import { Link } from 'react-router-dom'
import { useVehicles } from '../../hooks/useVehicles'
import { useWallet } from '../../hooks/useWallet'
import { useAuth } from '../../features/auth/useAuth'
import { formatMoney } from '../../utils/format'

export default function UserDashboardPage() {
  const { user } = useAuth()
  const wallet = useWallet()
  const vehicles = useVehicles()

  const activeCount = vehicles.data?.filter((v) => v.isActive).length ?? 0

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

      <section className="grid section-gap">
        <article className="card">
          <h3>Wallet balance</h3>
          <p className="stat">{wallet.data ? formatMoney(wallet.data.balance) : '...'}</p>
          <Link to="/app/wallet" className="link">
            Top up or view history
          </Link>
        </article>

        <article className="card">
          <h3>Active vehicles</h3>
          <p className="stat">{vehicles.data ? activeCount : '...'}</p>
          <Link to="/app/vehicles" className="link">
            Manage vehicles
          </Link>
        </article>

        <article className="card">
          <h3>Recent tolls</h3>
          <p className="muted">Your toll history will appear here once toll processing is built.</p>
        </article>
      </section>
    </>
  )
}