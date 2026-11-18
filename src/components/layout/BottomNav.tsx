import { NavLink } from 'react-router'
import { ClipboardCheck, Home, LayoutDashboard, Megaphone, Menu, Receipt, Wallet, Wrench } from 'lucide-react'
import { useAuth } from '../../features/auth/AuthProvider'
import { useUnreadAnnouncements } from '../../features/announcements/useUnreadAnnouncements'

const residentItems = [
  { to: '/', label: 'หน้าแรก', Icon: Home },
  { to: '/payments/upload', label: 'ส่งสลิป', Icon: Receipt },
  { to: '/repairs', label: 'แจ้งซ่อม', Icon: Wrench },
  { to: '/announcements', label: 'ประกาศ', Icon: Megaphone },
  { to: '/more', label: 'เพิ่มเติม', Icon: Menu },
]
const committeeItems = [
  { to: '/', label: 'ภาพรวม', Icon: LayoutDashboard },
  { to: '/admin/slips', label: 'ตรวจสลิป', Icon: ClipboardCheck },
  { to: '/maintenance', label: 'งานซ่อม', Icon: Wrench },
  { to: '/finance', label: 'การเงิน', Icon: Wallet },
  { to: '/more', label: 'เพิ่มเติม', Icon: Menu },
]

export function BottomNav() {
  const { roles } = useAuth()
  const unread = useUnreadAnnouncements()
  const items = roles.includes('committee') || roles.includes('admin') ? committeeItems : residentItems
  return (
    <nav aria-label="เมนูหลัก" className="fixed inset-x-0 bottom-0 z-30 grid h-[calc(72px+env(safe-area-inset-bottom))] grid-cols-5 border-t border-outline-soft bg-surface pb-[env(safe-area-inset-bottom)] shadow-nav lg:hidden">
      {items.map(({ to, label, Icon }) => (
        <NavLink key={to} className="flex min-h-[72px] flex-col items-center justify-center gap-1" end={to === '/'} to={to}>
          {({ isActive }) => (
            <>
              <span className={`relative grid h-8 w-14 place-items-center rounded-full ${isActive ? 'bg-primary-fixed' : ''}`}>
                <Icon aria-hidden="true" className={isActive ? 'text-primary' : 'text-text-muted'} size={24} />
                {to === '/announcements' && unread > 0 && (
                  <span aria-label={`${unread} ประกาศใหม่`} className="absolute -right-1 -top-1 grid min-h-[22px] min-w-[22px] place-items-center rounded-full bg-danger px-1 text-caption font-bold text-white">
                    {unread > 9 ? '9+' : unread}
                  </span>
                )}
              </span>
              <span className={`text-caption leading-[22px] ${isActive ? 'font-bold text-primary' : 'font-semibold text-text-muted'}`}>{label}</span>
            </>
          )}
        </NavLink>
      ))}
    </nav>
  )
}
