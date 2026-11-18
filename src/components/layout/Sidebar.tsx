import { NavLink, useNavigate } from 'react-router'
import { ClipboardCheck, ClipboardList, FileText, Grid3X3, HardHat, Home, KeyRound, LayoutDashboard, LogOut, Megaphone, Receipt, Settings, UserRound, Users, Wallet, Wrench } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { useAuth } from '../../features/auth/AuthProvider'
import { useUnreadAnnouncements } from '../../features/announcements/useUnreadAnnouncements'
import { Button } from '../ui/Button'
import { VillageBrandGlyph } from '../village/Roofline'

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
        { to: '/repairs', label: 'เรื่องแจ้งซ่อม', Icon: Wrench },
        { to: '/maintenance', label: 'งานซ่อม', Icon: Wrench },
        { to: '/assets', label: 'ทะเบียนอุปกรณ์', Icon: ClipboardList },
        { to: '/finance', label: 'การเงิน', Icon: Wallet },
        { to: '/admin/payment-status', label: 'สถานะการจ่าย', Icon: Grid3X3 },
        { to: '/reports', label: 'รายงานการเงิน', Icon: FileText },
        { to: '/admin/contractors', label: 'รายชื่อช่าง', Icon: HardHat },
        { to: '/announcements', label: 'ประกาศ', Icon: Megaphone },
        ...(admin ? [
          { to: '/admin/houses', label: 'จัดการลูกบ้าน', Icon: Users },
          { to: '/admin/settings', label: 'ตั้งค่าหมู่บ้าน', Icon: Settings },
          { to: '/admin/password-requests', label: 'คำขอรีเซ็ตรหัสผ่าน', Icon: KeyRound },
        ] : []),
        { to: '/profile', label: 'โปรไฟล์', Icon: UserRound },
      ]
    : [
        { to: '/', label: 'หน้าแรก', Icon: Home },
        { to: '/payments/upload', label: 'ส่งสลิป', Icon: Receipt },
        { to: '/payments/history', label: 'ประวัติการชำระ', Icon: Wallet },
        { to: '/repairs', label: 'แจ้งซ่อม', Icon: Wrench },
        { to: '/announcements', label: 'ประกาศ', Icon: Megaphone },
        { to: '/profile', label: 'โปรไฟล์', Icon: UserRound },
      ]
  return (
    <aside className="fixed inset-y-0 left-0 hidden w-sidebar flex-col overflow-y-auto bg-surface-low px-5 py-6 lg:flex">
      <div className="mb-8 flex items-center gap-3">
        <VillageBrandGlyph />
        <div>
          <h1 className="font-display text-h3 font-bold text-text-heading">หมู่บ้านตัวอย่าง</h1>
          <p className="text-caption text-text-muted">ระบบหมู่บ้าน</p>
        </div>
      </div>
      <nav aria-label="เมนูหลัก" className="grid gap-1">
        {items.map(({ to, label, Icon }) => (
          <NavLink key={to} className={({ isActive }) => `flex min-h-touch items-center gap-3 rounded-md px-3 font-semibold ${isActive ? 'bg-primary-fixed text-on-primary-fixed font-bold' : 'text-text-body hover:bg-surface-high'}`} end={to === '/'} to={to}>
            <Icon aria-hidden="true" size={22} />{label}
            {to === '/announcements' && unread > 0 && <span aria-label={`${unread} ประกาศใหม่`} className="ml-auto grid min-h-[22px] min-w-[22px] place-items-center rounded-full bg-danger px-1 text-caption font-bold text-white">{unread > 9 ? '9+' : unread}</span>}
          </NavLink>
        ))}
      </nav>
      <div className="mt-auto flex items-center gap-3 pt-5">
        <span className="grid size-10 shrink-0 place-items-center rounded-md bg-primary-fixed font-display text-h3 font-bold text-on-primary-fixed">
          {house?.house_no ?? <UserRound aria-hidden="true" size={22} />}
        </span>
        <div className="min-w-0 flex-1">
          <p className="line-clamp-2 font-semibold text-text-heading">{profile?.display_name}</p>
          <p className="text-caption text-text-muted">{house ? 'ลูกบ้าน' : 'กรรมการหมู่บ้าน'}</p>
        </div>
      </div>
      <div className="pt-2">
        <Button
          className="w-full justify-start px-3"
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
