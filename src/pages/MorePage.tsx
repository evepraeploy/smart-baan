import { Link } from 'react-router'
import { Banknote, Bell, ClipboardList, FileText, Home, KeyRound, Settings, UserRound, Users, Wrench } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { Card } from '../components/ui/Card'
import { QuickCallBar } from '../components/layout/QuickCallBar'
import { useAuth } from '../features/auth/AuthProvider'

export function MorePage() {
  const { roles, house } = useAuth()
  const committee = roles.includes('committee') || roles.includes('admin')
  const admin = roles.includes('admin')
  const links = [
    ...(!committee ? [
      { to: '/payments/history', label: 'ประวัติการชำระ', Icon: Banknote },
      { to: '/repairs', label: 'แจ้งซ่อม', Icon: Wrench },
    ] : []),
    { to: '/announcements', label: 'ประกาศ', Icon: Bell },
    ...(committee ? [
      { to: '/maintenance', label: 'งานซ่อม', Icon: Wrench },
      { to: '/finance', label: 'การเงิน', Icon: Banknote },
    ] : []),
    { to: '/profile', label: 'โปรไฟล์', Icon: UserRound },
    ...(admin ? [
      { to: '/admin/houses', label: 'จัดการลูกบ้าน', Icon: Users },
      { to: '/admin/settings', label: 'ตั้งค่าหมู่บ้าน', Icon: Settings },
      { to: '/admin/password-requests', label: 'คำขอรีเซ็ตรหัสผ่าน', Icon: KeyRound },
    ] : []),
    { to: '/reports', label: 'รายงานการเงิน', Icon: FileText },
    ...(committee ? [{ to: '/assets', label: 'ทะเบียนอุปกรณ์', Icon: ClipboardList }] : []),
  ]
  return (
    <div className="grid gap-5">
      <h1 className="text-h1 font-bold text-text-heading">เพิ่มเติม</h1>
      {committee && house && <section className="grid gap-3">
        <h2 className="text-h2 font-bold text-text-heading">บ้านของฉัน</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <MoreLink icon={Home} label="ส่งสลิป" to="/payments/upload" />
          <MoreLink icon={Banknote} label="ประวัติการชำระ" to="/payments/history" />
        </div>
      </section>}
      <section className="grid gap-3">
        <h2 className="text-h2 font-bold text-text-heading">เมนูทั้งหมด</h2>
        <div className="grid gap-3 sm:grid-cols-2">{links.map(({ to, label, Icon }) => <MoreLink icon={Icon} key={to} label={label} to={to} />)}</div>
      </section>
      <QuickCallBar />
    </div>
  )
}

function MoreLink({ to, label, icon: Icon }: { to: string; label: string; icon: LucideIcon }) {
  return <Link to={to}><Card className="flex min-h-touch items-center gap-3 py-3 hover:border-primary-700"><span className="grid size-11 place-items-center rounded-full bg-primary-50 text-primary-700"><Icon size={22} /></span><span className="font-semibold text-text-heading">{label}</span></Card></Link>
}
