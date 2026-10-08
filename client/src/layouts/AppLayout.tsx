import { Link, Outlet, useNavigate } from 'react-router-dom'
import ApiStatusChip from '../components/ui/ApiStatusChip'
import { useAuth } from '../features/auth/useAuth'
import { roleHome } from '../utils/roleHome'

// Shell for every logged-in page. Later slices add role-specific nav links here.
export default function AppLayout() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  const handleLogout = () => {
    logout()
    navigate('/login', { replace: true })
  }

  return (
    <div className="shell">
      <header className="topbar">
        <Link to={user ? roleHome(user.role) : '/'} className="brand">
          🛣️ TollCloud
        </Link>
        <nav className="nav">
          <span className="nav__user">
            {user?.name} <span className="badge">{user?.role}</span>
          </span>
          <button type="button" className="btn btn--small btn--ghost" onClick={handleLogout}>
            Logout
          </button>
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