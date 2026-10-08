import { useAuth } from '../features/auth/useAuth'

// Temporary landing page for /app, /operator and /admin.
// Replaced by real dashboards in later slices.
export default function RoleHomePage() {
  const { user } = useAuth()

  return (
    <section className="card">
      <h2>Welcome, {user?.name}</h2>
      <p>
        You are signed in as <strong>{user?.role}</strong> ({user?.email}). Your dashboard will
        appear here in a later slice.
      </p>
    </section>
  )
}