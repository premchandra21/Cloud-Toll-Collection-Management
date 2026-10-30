import { Link, Outlet, useLocation } from 'react-router-dom'
import ApiStatusChip from '../components/ui/ApiStatusChip'
import { useAuth } from '../features/auth/useAuth'
import { roleHome } from '../utils/roleHome'

export default function PublicLayout() {
  const { user } = useAuth()
  const { pathname } = useLocation()

  return (
    <div className="shell">
      <header className="topbar">
        <Link to="/" className="brand">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 21V8l7-4 7 4v13" /><path d="M5 12h14M9 21v-5h6v5" /></svg>
          TollCloud
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

      <main className={pathname === '/' ? 'content content--wide' : 'content'}>
        <Outlet />
      </main>

      <footer className="footer">
        <span>Cloud-Based Toll Collection &amp; Revenue Management</span>
        <ApiStatusChip />
      </footer>
    </div>
  )
}