import { Link, Outlet } from 'react-router-dom'
import ApiStatusChip from '../components/ui/ApiStatusChip'

export default function PublicLayout() {
  return (
    <div className="shell">
      <header className="topbar">
        <Link to="/" className="brand">
          🛣️ TollCloud
        </Link>
        <nav className="nav">
          <Link to="/">Home</Link>
          <Link to="/login" className="btn btn--small">
            Login
          </Link>
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