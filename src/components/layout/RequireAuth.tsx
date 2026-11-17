import { Navigate, Outlet, useLocation } from 'react-router'
import { Spinner } from '../ui/Spinner'
import { useAuth, type AppRole } from '../../features/auth/AuthProvider'
import { messages } from '../../lib/messages.th'

export function RequireAuth() {
  const { session, profile, loading } = useAuth()
  const location = useLocation()
  if (loading) return <Spinner />
  if (!session || !profile) return <Navigate to="/login" replace state={{ from: location.pathname }} />
  if (profile.must_change_password && location.pathname !== '/change-password') {
    return <Navigate to="/change-password" replace />
  }
  return <Outlet />
}

export function RequireRole({ roles }: { roles: AppRole[] }) {
  const auth = useAuth()
  const allowed = roles.some((role) => auth.roles.includes(role))
  if (!allowed) return <Navigate to="/forbidden" replace state={{ message: messages.forbidden }} />
  return <Outlet />
}
