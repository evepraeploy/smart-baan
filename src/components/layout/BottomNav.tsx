import { NavLink } from 'react-router'
import { Banknote, Bell, ClipboardCheck, Home, LayoutDashboard, Menu, Wrench, Upload } from 'lucide-react'
import { useAuth } from '../../features/auth/AuthProvider'

const residentItems = [
  { to: '/', label: 'หน้าแรก', Icon: Home },
  { to: '/payments/upload', label: 'ส่งสลิป', Icon: Upload },
  { to: '/repairs', label: 'แจ้งซ่อม', Icon: Wrench },
  { to: '/announcements', label: 'ประกาศ', Icon: Bell },
  { to: '/more', label: 'เพิ่มเติม', Icon: Menu },
]
const committeeItems = [
  { to: '/', label: 'ภาพรวม', Icon: LayoutDashboard },
  { to: '/admin/slips', label: 'ตรวจสลิป', Icon: ClipboardCheck },
  { to: '/maintenance', label: 'งานซ่อม', Icon: Wrench },
  { to: '/finance', label: 'การเงิน', Icon: Banknote },
  { to: '/more', label: 'เพิ่มเติม', Icon: Menu },
]

export function BottomNav() {
  const { roles } = useAuth()
  const items = roles.includes('committee') || roles.includes('admin') ? committeeItems : residentItems
  return (
    <nav aria-label="เมนูหลัก" className="fixed inset-x-0 bottom-0 z-30 grid h-[calc(64px+env(safe-area-inset-bottom))] grid-cols-5 border-t border-border-strong bg-white pb-[env(safe-area-inset-bottom)] shadow-nav lg:hidden">
      {items.map(({ to, label, Icon }) => (
        <NavLink key={to} className={({ isActive }) => `relative flex min-h-touch flex-col items-center justify-center gap-0.5 text-caption font-semibold ${isActive ? 'bg-primary-50 text-primary-700 before:absolute before:inset-x-0 before:top-0 before:h-[3px] before:bg-primary-700' : 'text-text-muted'}`} end={to === '/'} to={to}>
          <Icon aria-hidden="true" size={24} />
          <span>{label}</span>
        </NavLink>
      ))}
    </nav>
  )
}
