import { Link, useNavigate } from 'react-router'
import {
  Banknote,
  ChevronRight,
  ClipboardCheck,
  ClipboardList,
  FileText,
  Grid3X3,
  HardHat,
  Home,
  Images,
  KeyRound,
  LogOut,
  Megaphone,
  Receipt,
  Settings,
  UserRound,
  Users,
  Wallet,
  Wrench,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { Button } from '../components/ui/Button'
import { Card } from '../components/ui/Card'
import { IconTile } from '../components/ui/IconTile'
import { QuickCallBar } from '../components/layout/QuickCallBar'
import { useAuth } from '../features/auth/AuthProvider'

type MoreItem = { to: string; label: string; Icon: LucideIcon; tone: 'primary' | 'secondary' | 'neutral' | 'danger' }
type MoreGroup = { title: string; items: MoreItem[] }

export function MorePage() {
  const { roles, house, logout } = useAuth()
  const navigate = useNavigate()
  const committee = roles.includes('committee') || roles.includes('admin')
  const admin = roles.includes('admin')
  const groups: MoreGroup[] = [
    {
      title: 'บ้านของฉัน',
      items: [
        { to: '/', label: 'หน้าแรก', Icon: Home, tone: 'primary' },
        ...(!committee || house ? [
          { to: '/payments/upload', label: 'ส่งสลิป', Icon: Receipt, tone: 'primary' as const },
          { to: '/payments/history', label: 'ประวัติการชำระ', Icon: Banknote, tone: 'neutral' as const },
        ] : []),
      ],
    },
    {
      title: 'การเงิน',
      items: [
        ...(committee ? [{ to: '/finance', label: 'การเงิน', Icon: Wallet, tone: 'primary' as const }] : []),
        { to: '/reports', label: 'รายงานการเงิน', Icon: FileText, tone: 'neutral' },
      ],
    },
    {
      title: 'งานซ่อม',
      items: committee
        ? [
            { to: '/repairs', label: 'เรื่องแจ้งซ่อม', Icon: Wrench, tone: 'primary' },
            { to: '/maintenance', label: 'งานซ่อม', Icon: Wrench, tone: 'secondary' },
            { to: '/assets', label: 'ทะเบียนอุปกรณ์', Icon: ClipboardList, tone: 'neutral' },
          ]
        : [{ to: '/repairs', label: 'แจ้งซ่อม', Icon: Wrench, tone: 'secondary' }],
    },
    { title: 'ข่าวสาร', items: [{ to: '/announcements', label: 'ประกาศ', Icon: Megaphone, tone: 'secondary' }] },
    ...(committee ? [{
      title: 'ผู้ดูแลระบบ',
      items: [
        { to: '/admin/slips', label: 'ตรวจสลิป', Icon: ClipboardCheck, tone: 'secondary' as const },
        { to: '/admin/slips?tab=reviewed', label: 'สลิปย้อนหลัง', Icon: Images, tone: 'neutral' as const },
        { to: '/admin/payment-status', label: 'สถานะการจ่าย', Icon: Grid3X3, tone: 'neutral' as const },
        { to: '/admin/contractors', label: 'รายชื่อช่าง', Icon: HardHat, tone: 'neutral' as const },
        ...(admin ? [
          { to: '/admin/houses', label: 'จัดการลูกบ้าน', Icon: Users, tone: 'neutral' as const },
          { to: '/admin/settings', label: 'ตั้งค่าหมู่บ้าน', Icon: Settings, tone: 'neutral' as const },
          { to: '/admin/password-requests', label: 'คำขอรีเซ็ตรหัสผ่าน', Icon: KeyRound, tone: 'danger' as const },
        ] : []),
      ],
    }] : []),
    { title: 'บัญชี', items: [{ to: '/profile', label: 'โปรไฟล์', Icon: UserRound, tone: 'neutral' }] },
  ]

  return (
    <div className="grid gap-6">
      <h1 className="font-display text-h1 font-bold text-text-heading">เพิ่มเติม</h1>
      {groups.map((group) => (
        <section aria-label={group.title} className="grid gap-2" key={group.title}>
          <h2 className="text-caption font-semibold text-text-muted">{group.title}</h2>
          <div className="grid gap-2 sm:grid-cols-2">
            {group.items.map((item) => <MoreLink {...item} key={item.to} />)}
          </div>
        </section>
      ))}
      <QuickCallBar />
      <Button
        className="w-full"
        onClick={async () => {
          await logout()
          navigate('/login', { replace: true })
        }}
        variant="danger-outline"
      >
        <LogOut aria-hidden="true" size={20} />ออกจากระบบ
      </Button>
    </div>
  )
}

function MoreLink({ to, label, Icon, tone }: MoreItem) {
  return (
    <Link to={to}>
      <Card className="flex min-h-16 items-center gap-3 transition hover:border-primary-container">
        <IconTile icon={Icon} size="M" tone={tone} />
        <h3 className="min-w-0 flex-1 font-display text-h3 font-bold text-text-heading">{label}</h3>
        <ChevronRight aria-hidden="true" className="shrink-0 text-text-muted" size={24} />
      </Card>
    </Link>
  )
}
