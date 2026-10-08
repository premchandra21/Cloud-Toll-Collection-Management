import { Navigate, Outlet, useLocation } from 'react-router-dom'
import type { Role } from '../../types/auth'
import { roleHome } from '../../utils/roleHome'
import { useAuth } from './useAuth'

interface Props {
  allowedRoles?: Role[]
}

export default function ProtectedRoute({ allowedRoles }: Props) {
  const { user, isLoading } = useAuth()
  const location = useLocation()

  if (isLoading) return <p className="muted">Loading...</p>

  if (!user) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />
  }

  if (allowedRoles && !allowedRoles.includes(user.role)) {
    return <Navigate to={roleHome(user.role)} replace />
  }

  return <Outlet />
}