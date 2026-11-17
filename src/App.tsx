import { Navigate, Route, Routes } from 'react-router'
import { AppShell } from './components/layout/AppShell'
import { RequireAuth, RequireRole } from './components/layout/RequireAuth'
import { useAuth } from './features/auth/AuthProvider'
import { ChangePasswordPage } from './features/auth/ChangePasswordPage'
import { LoginPage } from './features/auth/LoginPage'
import { ProfilePage } from './features/auth/ProfilePage'
import { HousesPage } from './features/admin/HousesPage'
import { SettingsPage } from './features/admin/SettingsPage'
import { PaymentHistoryPage } from './features/payments/PaymentHistoryPage'
import { UploadSlipPage } from './features/payments/UploadSlipPage'
import { SlipReviewPage } from './features/review/SlipReviewPage'
import { ComingSoonPage } from './pages/ComingSoonPage'
import { ForbiddenPage } from './pages/ForbiddenPage'
import { HomePage } from './pages/HomePage'
import { MorePage } from './pages/MorePage'
import { NotFoundPage } from './pages/NotFoundPage'

function LoginRoute() {
  const { session, profile, loading } = useAuth()
  if (!loading && session && profile) return <Navigate to={profile.must_change_password ? '/change-password' : '/'} replace />
  return <LoginPage />
}

export default function App() {
  return (
    <Routes>
      <Route element={<LoginRoute />} path="/login" />
      <Route element={<RequireAuth />}>
        <Route element={<ChangePasswordPage />} path="/change-password" />
        <Route element={<ForbiddenPage />} path="/forbidden" />
        <Route element={<AppShell />}>
          <Route element={<HomePage />} index />
          <Route element={<UploadSlipPage />} path="payments/upload" />
          <Route element={<PaymentHistoryPage />} path="payments/history" />
          <Route element={<MorePage />} path="more" />
          <Route element={<ProfilePage />} path="profile" />
          <Route element={<ComingSoonPage title="แจ้งซ่อม" />} path="repairs" />
          <Route element={<ComingSoonPage title="ประกาศ" />} path="announcements" />
          <Route element={<ComingSoonPage title="รายงานการเงิน" />} path="reports" />
          <Route element={<RequireRole roles={['committee', 'admin']} />}>
            <Route element={<SlipReviewPage />} path="admin/slips" />
            <Route element={<ComingSoonPage title="งานซ่อม" />} path="maintenance" />
            <Route element={<ComingSoonPage title="การเงิน" />} path="finance" />
            <Route element={<ComingSoonPage title="ทะเบียนอุปกรณ์" />} path="assets" />
          </Route>
          <Route element={<RequireRole roles={['admin']} />}>
            <Route element={<HousesPage />} path="admin/houses" />
            <Route element={<SettingsPage />} path="admin/settings" />
          </Route>
          <Route element={<RequireRole roles={['committee', 'admin']} />}>
            <Route element={<NotFoundPage />} path="admin/*" />
          </Route>
        </Route>
      </Route>
      <Route element={<NotFoundPage />} path="*" />
    </Routes>
  )
}
