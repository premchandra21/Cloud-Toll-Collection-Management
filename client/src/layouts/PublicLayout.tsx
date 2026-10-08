import { Link, Outlet } from 'react-router-dom'
import ApiStatusChip from '../components/ui/ApiStatusChip'
import { useAuth } from '../features/auth/useAuth'
import { roleHome } from '../utils/roleHome'

export default function PublicLayout() {
  const { user } = useAuth()

  return (
    <div className="shell">
      <header className="topbar">
        <Link to="/" className="brand">
          🛣️ TollCloud
        </Link>
        <nav className="nav">
          <Link to="/">Home</Link>
          {user ? (
            <Link to={roleHome(user.role)} className="btn btn--small">
              Dashboard
            </Link>
          ) : (
            <>
              <Link to="/register">Register</Link>
              <Link to="/login" className="btn btn--small">
                Login
              </Link>
            </>
          )}
        </nav>
      </header>

      <main className="content">
        <Outlet />
      </main>

      <footer className="footer">
        <span>Cloud-Based Toll Collection &amp; Revenue Management</span>
        <ApiStatusChip />
      </footer>
    </div>
  )
}