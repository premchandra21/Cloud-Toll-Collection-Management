import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom'
import ApiStatusChip from '../components/ui/ApiStatusChip'
import { useAuth } from '../features/auth/useAuth'
import { roleHome } from '../utils/roleHome'

const USER_LINKS = [
  { to: '/app', label: 'Dashboard', end: true },
  { to: '/app/vehicles', label: 'Vehicles', end: false },
  { to: '/app/wallet', label: 'Wallet', end: false },
]

// Shell for every logged-in page. Later slices add OPERATOR / ADMIN links here.
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
          {user?.role === 'USER' &&
            USER_LINKS.map((l) => (
              <NavLink
                key={l.to}
                to={l.to}
                end={l.end}
                className={({ isActive }) => `nav__link${isActive ? ' nav__link--active' : ''}`}
              >
                {l.label}
              </NavLink>
            ))}
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