import { useState } from 'react'
import { Outlet, useLocation, useNavigate } from 'react-router'
import { ArrowLeft, Phone } from 'lucide-react'
import { BottomNav } from './BottomNav'
import { Sidebar } from './Sidebar'
import { OfflineBanner } from './OfflineBanner'
import { labels } from '../../lib/messages.th'
import { useHotlines } from './useHotlines'
import { HotlineList } from './QuickCallBar'
import { VillageBrandGlyph } from '../village/Roofline'
import { Modal } from '../ui/Modal'
import { useAuth } from '../../features/auth/AuthProvider'
import { getMobileBackFallback } from '../../lib/mobile-nav'

const residentTabs = new Set(['/', '/payments/upload', '/repairs', '/announcements', '/more'])
const committeeTabs = new Set(['/', '/admin/slips', '/maintenance', '/finance', '/more'])

const pageTitles: Record<string, string> = {
  '/': 'หน้าแรก',
  '/payments/upload': 'ส่งสลิป',
  '/payments/history': 'ประวัติการชำระ',
  '/admin/slips': 'ตรวจสลิป',
  '/admin/houses': 'จัดการลูกบ้าน',
  '/admin/password-requests': 'คำขอรีเซ็ตรหัสผ่าน',
  '/admin/payment-status': 'สถานะการจ่าย',
  '/reports': 'รายงานการเงิน',
  '/profile': 'โปรไฟล์',
  '/more': labels.more,
  '/repairs': 'แจ้งซ่อม',
  '/repairs/new': 'แจ้งเรื่องใหม่',
  '/announcements': 'ประกาศ',
  '/maintenance': 'งานซ่อม',
  '/assets': 'ทะเบียนอุปกรณ์',
  '/finance': 'การเงิน',
  '/admin/settings': 'ตั้งค่าหมู่บ้าน',
  '/admin/contractors': 'รายชื่อช่าง',
}

export function AppShell() {
  const location = useLocation()
  const navigate = useNavigate()
  const { roles, house } = useAuth()
  const committee = roles.includes('committee') || roles.includes('admin')
  const admin = roles.includes('admin')
  const [hotlinesOpen, setHotlinesOpen] = useState(false)
  const hotlines = useHotlines()
  const title = pageTitles[location.pathname] ?? (location.pathname.startsWith('/repairs/') ? 'รายละเอียดเรื่อง' : location.pathname.startsWith('/maintenance/') ? 'รายละเอียดงานซ่อม' : location.pathname.startsWith('/assets/') ? 'รายละเอียดอุปกรณ์' : 'ระบบหมู่บ้าน')
  const showBack = !(committee ? committeeTabs : residentTabs).has(location.pathname)
  const backFallback = getMobileBackFallback(location.pathname, { committee, hasHouse: Boolean(house), admin })
  return (
    <div className="min-h-dvh">
      <Sidebar />
      <div className="min-h-dvh lg:pl-sidebar">
        <OfflineBanner />
        <header className="sticky top-0 z-20 border-b border-outline-soft bg-canvas px-4 pt-[env(safe-area-inset-top)] lg:hidden">
          <div className="flex h-16 items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3">
              {showBack ? (
                <button
                  aria-label="ย้อนกลับ"
                  className="grid size-12 shrink-0 place-items-center rounded-full hover:bg-surface-low"
                  onClick={() => location.key === 'default' ? navigate(backFallback, { replace: true }) : navigate(-1)}
                  type="button"
                >
                  <ArrowLeft aria-hidden="true" size={24} />
                </button>
              ) : <VillageBrandGlyph />}
              <div className="line-clamp-1 min-w-0 font-display text-h2 font-semibold text-text-heading">
                {location.pathname === '/' ? 'หมู่บ้านตัวอย่าง' : title}
              </div>
            </div>
            {hotlines.length > 0 && (
              <button
                aria-label="โทรด่วน"
                className="inline-flex min-h-touch min-w-touch shrink-0 items-center justify-center gap-2 rounded-full bg-danger-container px-3 text-caption font-semibold text-on-danger-container sm:px-4"
                onClick={() => setHotlinesOpen(true)}
                type="button"
              >
                <Phone aria-hidden="true" size={20} />
                <span className="sm:hidden">โทร</span>
                <span className="hidden sm:inline">โทรด่วน</span>
              </button>
            )}
          </div>
        </header>
        <main className="mx-auto min-h-[calc(100dvh-4rem)] max-w-content px-4 py-5 pb-28 sm:px-6 lg:px-8 lg:py-8">
          <Outlet />
        </main>
        <BottomNav />
      </div>
      <Modal onClose={() => setHotlinesOpen(false)} open={hotlinesOpen} title="ติดต่อด่วน">
        <HotlineList hotlines={hotlines} />
      </Modal>
    </div>
  )
}
