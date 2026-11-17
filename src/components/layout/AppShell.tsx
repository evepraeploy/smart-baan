import { Outlet, useLocation } from 'react-router'
import { BottomNav } from './BottomNav'
import { Sidebar } from './Sidebar'
import { OfflineBanner } from './OfflineBanner'
import { useAuth } from '../../features/auth/AuthProvider'
import { labels } from '../../lib/messages.th'

const pageTitles: Record<string, string> = {
  '/': 'หน้าแรก',
  '/payments/upload': 'ส่งสลิป',
  '/payments/history': 'ประวัติการชำระ',
  '/admin/slips': 'ตรวจสลิป',
  '/admin/houses': 'จัดการลูกบ้าน',
  '/profile': 'โปรไฟล์',
  '/more': labels.more,
  '/repairs': 'แจ้งซ่อม',
  '/announcements': 'ประกาศ',
  '/maintenance': 'งานซ่อม',
  '/finance': 'การเงิน',
  '/admin/settings': 'ตั้งค่าหมู่บ้าน',
}

export function AppShell() {
  const location = useLocation()
  const { house } = useAuth()
  const title = pageTitles[location.pathname] ?? 'ระบบหมู่บ้าน'
  return (
    <div className="min-h-dvh">
      <Sidebar />
      <div className="min-h-dvh lg:pl-sidebar">
        <OfflineBanner />
        <header className="sticky top-0 z-20 border-b border-border bg-canvas/95 px-4 py-3 backdrop-blur-sm lg:hidden">
          <p className="text-caption font-semibold text-primary-700">หมู่บ้านตัวอย่าง{house ? ` · บ้านเลขที่ ${house.house_no}` : ''}</p>
          <h1 className="text-h2 font-bold text-text-heading">{title}</h1>
        </header>
        <main className="mx-auto min-h-[calc(100dvh-4rem)] max-w-content px-4 py-5 pb-28 sm:px-6 lg:px-8 lg:py-8">
          <Outlet />
        </main>
        <BottomNav />
      </div>
    </div>
  )
}
