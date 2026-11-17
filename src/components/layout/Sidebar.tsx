import { NavLink, useNavigate } from 'react-router'
import { Banknote, Bell, ClipboardCheck, ClipboardList, FileText, Grid3X3, HardHat, Home, KeyRound, LayoutDashboard, LogOut, Settings, UserRound, Users, Wrench } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { useAuth } from '../../features/auth/AuthProvider'
import { useUnreadAnnouncements } from '../../features/announcements/useUnreadAnnouncements'
import { Button } from '../ui/Button'

type Item = { to: string; label: string; Icon: LucideIcon }

export function Sidebar() {
  const { profile, house, roles, logout } = useAuth()
  const unread = useUnreadAnnouncements()
  const navigate = useNavigate()
  const committee = roles.includes('committee') || roles.includes('admin')
  const admin = roles.includes('admin')
  const items: Item[] = committee
    ? [
        { to: '/', label: 'ภาพรวม', Icon: LayoutDashboard },
        { to: '/admin/slips', label: 'ตรวจสลิป', Icon: ClipboardCheck },
        { to: '/maintenance', label: 'งานซ่อม', Icon: Wrench },
        { to: '/assets', label: 'ทะเบียนอุปกรณ์', Icon: ClipboardList },
        { to: '/finance', label: 'การเงิน', Icon: Banknote },
        { to: '/admin/payment-status', label: 'สถานะการจ่าย', Icon: Grid3X3 },
        { to: '/reports', label: 'รายงานการเงิน', Icon: FileText },
        { to: '/admin/contractors', label: 'รายชื่อช่าง', Icon: HardHat },
        { to: '/announcements', label: 'ประกาศ', Icon: Bell },
        ...(admin ? [
          { to: '/admin/houses', label: 'จัดการลูกบ้าน', Icon: Users },
          { to: '/admin/settings', label: 'ตั้งค่าหมู่บ้าน', Icon: Settings },
          { to: '/admin/password-requests', label: 'คำขอรีเซ็ตรหัสผ่าน', Icon: KeyRound },
        ] : []),
        { to: '/profile', label: 'โปรไฟล์', Icon: UserRound },
      ]
    : [
        { to: '/', label: 'หน้าแรก', Icon: Home },
        { to: '/payments/upload', label: 'ส่งสลิป', Icon: ClipboardCheck },
        { to: '/payments/history', label: 'ประวัติการชำระ', Icon: Banknote },
        { to: '/repairs', label: 'แจ้งซ่อม', Icon: Wrench },
        { to: '/announcements', label: 'ประกาศ', Icon: Bell },
        { to: '/profile', label: 'โปรไฟล์', Icon: UserRound },
      ]
  return (
    <aside className="fixed inset-y-0 left-0 hidden w-sidebar flex-col border-r border-border bg-white px-5 py-6 lg:flex">
      <div className="mb-9">
        <p className="text-caption font-semibold text-primary-700">ระบบจัดการหมู่บ้าน</p>
        <h1 className="mt-1 text-h2 font-bold text-text-heading">หมู่บ้านตัวอย่าง</h1>
      </div>
      <nav aria-label="เมนูหลัก" className="grid gap-1">
        {items.map(({ to, label, Icon }) => (
          <NavLink key={to} className={({ isActive }) => `flex min-h-touch items-center gap-3 rounded-md border-l-[3px] px-3 font-semibold ${isActive ? 'border-primary-700 bg-primary-50 text-primary-700' : 'border-transparent text-text-body hover:bg-subtle'}`} end={to === '/'} to={to}>
            <Icon aria-hidden="true" size={22} />{label}
            {to === '/announcements' && unread > 0 && <span aria-label={`${unread} ประกาศใหม่`} className="ml-auto grid min-h-6 min-w-6 place-items-center rounded-full bg-status-danger-bg px-1 text-caption font-bold text-status-danger-fg">{unread > 9 ? '9+' : unread}</span>}
          </NavLink>
        ))}
      </nav>
      <div className="mt-auto border-t border-border pt-5">
        <p className="font-semibold text-text-heading">{profile?.display_name}</p>
        <p className="text-caption text-text-muted">{house ? `บ้านเลขที่ ${house.house_no}` : 'กรรมการหมู่บ้าน'}</p>
        <Button
          className="mt-3 w-full justify-start px-3"
          onClick={async () => {
            await logout()
            navigate('/login', { replace: true })
          }}
          variant="quiet"
        >
          <LogOut aria-hidden="true" size={20} />ออกจากระบบ
        </Button>
      </div>
    </aside>
  )
}
