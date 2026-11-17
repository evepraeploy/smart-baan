import { Navigate, Route, Routes } from 'react-router'
import { AppShell } from './components/layout/AppShell'
import { RequireAuth, RequireRole } from './components/layout/RequireAuth'
import { useAuth } from './features/auth/AuthProvider'
import { ChangePasswordPage } from './features/auth/ChangePasswordPage'
import { ForgotPasswordPage } from './features/auth/ForgotPasswordPage'
import { LoginPage } from './features/auth/LoginPage'
import { ProfilePage } from './features/auth/ProfilePage'
import { HousesPage } from './features/admin/HousesPage'
import { PasswordRequestsPage } from './features/admin/PasswordRequestsPage'
import { SettingsPage } from './features/admin/SettingsPage'
import { AnnouncementsPage } from './features/announcements/AnnouncementsPage'
import { FinanceReportPage } from './features/finance/FinanceReportPage'
import { LedgerPage } from './features/finance/LedgerPage'
import { PaymentStatusPage } from './features/payments/PaymentStatusPage'
import { TicketListPage } from './features/tickets/TicketListPage'
import { NewTicketPage } from './features/tickets/NewTicketPage'
import { TicketDetailPage } from './features/tickets/TicketDetailPage'
import { MaintenanceBoardPage } from './features/tickets/MaintenanceBoardPage'
import { ContractorsPage } from './features/tickets/ContractorsPage'
import { AssetsPage } from './features/assets/AssetsPage'
import { AssetDetailPage } from './features/assets/AssetDetailPage'
import { PaymentHistoryPage } from './features/payments/PaymentHistoryPage'
import { UploadSlipPage } from './features/payments/UploadSlipPage'
import { SlipReviewPage } from './features/review/SlipReviewPage'
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
      <Route element={<ForgotPasswordPage />} path="/forgot-password" />
      <Route element={<RequireAuth />}>
        <Route element={<ChangePasswordPage />} path="/change-password" />
        <Route element={<ForbiddenPage />} path="/forbidden" />
        <Route element={<AppShell />}>
          <Route element={<HomePage />} index />
          <Route element={<UploadSlipPage />} path="payments/upload" />
          <Route element={<PaymentHistoryPage />} path="payments/history" />
          <Route element={<MorePage />} path="more" />
          <Route element={<ProfilePage />} path="profile" />
          <Route element={<TicketListPage />} path="repairs" />
          <Route element={<NewTicketPage />} path="repairs/new" />
          <Route element={<TicketDetailPage />} path="repairs/:id" />
          <Route element={<AnnouncementsPage />} path="announcements" />
          <Route element={<FinanceReportPage />} path="reports" />
          <Route element={<RequireRole roles={['committee', 'admin']} />}>
            <Route element={<SlipReviewPage />} path="admin/slips" />
            <Route element={<PaymentStatusPage />} path="admin/payment-status" />
            <Route element={<MaintenanceBoardPage />} path="maintenance" />
            <Route element={<TicketDetailPage />} path="maintenance/:id" />
            <Route element={<ContractorsPage />} path="admin/contractors" />
            <Route element={<LedgerPage />} path="finance" />
            <Route element={<AssetsPage />} path="assets" />
            <Route element={<AssetDetailPage />} path="assets/:id" />
          </Route>
          <Route element={<RequireRole roles={['admin']} />}>
            <Route element={<HousesPage />} path="admin/houses" />
            <Route element={<PasswordRequestsPage />} path="admin/password-requests" />
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
