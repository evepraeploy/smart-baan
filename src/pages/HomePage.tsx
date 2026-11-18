import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import {
  CalendarClock,
  CalendarDays,
  ChartColumn,
  CheckCircle2,
  ChevronRight,
  ClipboardCheck,
  Clock,
  History,
  House,
  Images,
  Megaphone,
  Pin,
  PiggyBank,
  Phone,
  Receipt,
  TriangleAlert,
  UserRound,
  Wallet,
  Wrench,
} from 'lucide-react'
import { Button } from '../components/ui/Button'
import { Card } from '../components/ui/Card'
import { IconTile } from '../components/ui/IconTile'
import { NeutralBadge, StatusBadge } from '../components/ui/Badge'
import { Spinner } from '../components/ui/Spinner'
import { QuickCallBar } from '../components/layout/QuickCallBar'
import { useOffline } from '../components/layout/OfflineBanner'
import { useHotlines } from '../components/layout/useHotlines'
import { useToast } from '../components/ui/Toast'
import { Roofline, type RooflineHouse, type HousePaymentState } from '../components/village/Roofline'
import { useAuth } from '../features/auth/AuthProvider'
import { listAnnouncements, type Announcement } from '../features/announcements/api'
import { getFinanceReport } from '../features/finance/api'
import { getMonthPaymentStatus, getVillagePaymentSummary, type MonthPaymentStatus, type VillagePaymentSummary } from '../features/payments/statusApi'
import { getDueCountdown } from '../lib/bill-status'
import { formatAmount, formatDateTH, formatMonthTH, formatWeekdayDateTH } from '../lib/format'
import { toThaiError } from '../lib/errors'
import { messages } from '../lib/messages.th'
import type { Bill } from '../features/payments/api'
import { getCommitteeDashboard, type CommitteeDashboard } from '../features/assets/api'
import { PmBadge } from '../features/assets/AssetsPage'
import { supabase } from '../lib/supabase'

function currentPeriod() {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Bangkok',
    year: 'numeric',
    month: '2-digit',
  }).formatToParts(new Date())
  const year = parts.find((part) => part.type === 'year')?.value
  const month = parts.find((part) => part.type === 'month')?.value
  return `${year}-${month}-01`
}

function residentRoofline(summary: VillagePaymentSummary, houseStatus: VillagePaymentSummary['my_status']): RooflineHouse[] {
  const states: HousePaymentState[] = [
    ...Array.from({ length: summary.paid }, () => 'paid' as const),
    ...Array.from({ length: summary.pending_review }, () => 'pending' as const),
    ...Array.from({ length: summary.unpaid }, () => 'unpaid' as const),
  ]
  const mineState: HousePaymentState | null = houseStatus === 'pending_review' ? 'pending' : houseStatus
  const mineIndex = mineState ? states.indexOf(mineState) : -1
  return states.slice(0, summary.total).map((state, index) => ({
    key: `house-${index}`,
    state,
    mine: index === mineIndex,
  }))
}

export function HomePage() {
  const { roles, house, profile, session } = useAuth()
  const committee = roles.includes('committee') || roles.includes('admin')
  const [bill, setBill] = useState<Bill | null>(null)
  const [committeeDashboard, setCommitteeDashboard] = useState<CommitteeDashboard | null>(null)
  const [paymentHouses, setPaymentHouses] = useState<MonthPaymentStatus[] | null>(null)
  const [villageSummary, setVillageSummary] = useState<VillagePaymentSummary | null>(null)
  const [balance, setBalance] = useState<number | null>(null)
  const [announcements, setAnnouncements] = useState<Announcement[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [generating, setGenerating] = useState(false)
  const [refreshKey, setRefreshKey] = useState(0)
  const { showToast } = useToast()
  const offline = useOffline()
  const period = currentPeriod()
  const month = formatMonthTH(period)
  const hotlines = useHotlines()

  useEffect(() => {
    let active = true
    if (!supabase) {
      setLoading(false)
      return
    }
    async function load() {
      try {
        if (committee) {
          setCommitteeDashboard(null)
          if (active) setError('')
          const dashboard = await getCommitteeDashboard()
          if (active) setCommitteeDashboard(dashboard)
        } else if (house) {
          const { data, error: queryError } = await supabase!.from('bills')
            .select('id,house_id,period,amount,due_date,status,paid_at')
            .eq('house_id', house.id)
            .eq('period', period)
            .maybeSingle()
          if (queryError) throw queryError
          if (active) setBill(data as Bill | null)
        }
      } catch (caught) {
        if (active) setError(toThaiError(caught))
      } finally {
        if (active) setLoading(false)
      }
    }
    void load()
    return () => { active = false }
  }, [committee, house, period, refreshKey])

  useEffect(() => {
    if (!committee) return
    let active = true
    setPaymentHouses(null)
    void getMonthPaymentStatus(period).then((items) => {
      if (active) setPaymentHouses(items)
    }).catch(() => {
      if (active) setPaymentHouses(null)
    })
    return () => { active = false }
  }, [committee, period, refreshKey])

  useEffect(() => {
    if (committee || !session) return
    let active = true
    const year = Number(period.slice(0, 4))
    void Promise.allSettled([
      getVillagePaymentSummary(period),
      getFinanceReport(year),
      listAnnouncements(session.user.id),
    ]).then(([summaryResult, reportResult, announcementsResult]) => {
      if (!active) return
      if (summaryResult.status === 'fulfilled') setVillageSummary(summaryResult.value)
      else setVillageSummary(null)
      if (reportResult.status === 'fulfilled') setBalance(reportResult.value.balance)
      else setBalance(null)
      if (announcementsResult.status === 'fulfilled') setAnnouncements(announcementsResult.value.slice(0, 2))
      else setAnnouncements([])
    })
    return () => { active = false }
  }, [committee, period, session])

  async function generateBills() {
    if (!supabase || offline) return
    setGenerating(true)
    try {
      const { data, error: generationError } = await supabase.rpc('generate_monthly_bills', { p_period: period })
      if (generationError) showToast(toThaiError(generationError), 'error')
      else {
        showToast(`สร้างบิลเรียบร้อยแล้ว ${data ?? 0} รายการ`)
        setRefreshKey((current) => current + 1)
      }
    } catch (caught) {
      showToast(toThaiError(caught), 'error')
    } finally {
      setGenerating(false)
    }
  }

  const greeting = (
    <div className="flex items-center gap-4">
      {house ? (
        <span className="grid size-14 shrink-0 place-items-center rounded-lg bg-primary-fixed font-display text-h2 font-bold text-on-primary-fixed lg:size-[72px]">
          {house.house_no}
        </span>
      ) : (
        <IconTile icon={UserRound} size="L" tone="neutral" />
      )}
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="line-clamp-1 min-w-0 font-display text-h1 font-bold text-text-heading">สวัสดี คุณ{profile?.display_name}</h1>
          {committee && <NeutralBadge>กรรมการ</NeutralBadge>}
        </div>
        <p className="mt-1 flex items-center gap-2 text-body text-text-muted">
          <CalendarDays aria-hidden="true" size={20} />
          {formatWeekdayDateTH(new Date())}
        </p>
      </div>
    </div>
  )

  return (
    <div className="grid gap-6">
      {committee ? (
        <>
          <div className="flex flex-wrap items-center justify-between gap-4">
            {greeting}
            <div className="grid gap-1">
              <Button busy={generating} disabled={offline} onClick={() => void generateBills()} variant="secondary">
                สร้างบิลเดือนนี้
              </Button>
              {offline && <span className="text-caption text-secondary">{messages.offlineBills}</span>}
            </div>
          </div>
          {loading ? <Spinner /> : committeeDashboard ? (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-5">
              <SummaryTile icon={PiggyBank} label="ยอดคงเหลือ" value={`฿${formatAmount(committeeDashboard.balance)}`} to="/reports" tone="primary" />
              <SummaryTile icon={Wallet} label="รายรับเดือนนี้" value={`฿${formatAmount(committeeDashboard.month_income)}`} to="/finance" tone="primary" />
              <SummaryTile icon={Wallet} label="รายจ่ายเดือนนี้" value={`฿${formatAmount(committeeDashboard.month_expense)}`} to="/finance" tone="secondary" />
              <SummaryTile icon={ClipboardCheck} label="สลิปรอตรวจ" value={committeeDashboard.pending_slips} to="/admin/slips" tone="secondary" />
              <SummaryTile icon={Wrench} label="งานซ่อมค้าง" value={committeeDashboard.open_tickets} to="/maintenance" tone="secondary" />
            </div>
          ) : error ? null : <Card><p className="text-body text-text-muted">ยังไม่มีข้อมูล Dashboard</p></Card>}
          {paymentHouses && (
            <Link to="/admin/payment-status">
              <Card className="grid gap-4 transition duration-150 hover:shadow-raised">
                <div className="flex items-center gap-3">
                  <IconTile icon={House} size="M" tone="primary" />
                  <h2 className="font-display text-h2 font-semibold text-text-heading">สถานะค่าส่วนกลาง {month}</h2>
                </div>
                <CommitteeRoofline houses={paymentHouses} />
              </Card>
            </Link>
          )}
          {committeeDashboard && (
            <section className="grid gap-4 md:grid-cols-2">
              <PmSection assets={committeeDashboard.pm_overdue} title="เลยกำหนด PM" tone="danger" />
              <PmSection assets={committeeDashboard.pm_due_soon} title="PM ใน 14 วัน" tone="warning" />
            </section>
          )}
          {error && <p className="text-body text-danger">{error}</p>}
          <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3">
            <QuickActionTile description="ตรวจรายการที่ลูกบ้านส่งมา" icon={ClipboardCheck} label="ตรวจสลิปที่ส่งเข้ามา" tone="secondary" to="/admin/slips" />
            <QuickActionTile description="ดูรายรับและรายจ่ายหมู่บ้าน" icon={Wallet} label="ดูรายการการเงิน" tone="neutral" to="/finance" />
            <QuickActionTile description="สลิปที่อนุมัติ/ไม่ผ่านแล้ว" icon={Images} label="ดูสลิปย้อนหลัง" tone="neutral" to="/admin/slips?tab=reviewed" />
          </div>
        </>
      ) : (
        <>
          {greeting}
          <div className="grid gap-6 xl:grid-cols-12">
            <BillCard bill={bill} loading={loading} month={month} />
            <section className="order-2 grid grid-cols-2 gap-3 xl:grid-cols-4 xl:order-3 xl:col-span-12" aria-labelledby="quick-actions-heading">
              <h2 className="sr-only" id="quick-actions-heading">เมนูด่วน</h2>
              <QuickActionTile description="แจ้งเรื่องและติดตามสถานะ" icon={Wrench} label="แจ้งซ่อม" tone="secondary" to="/repairs" />
              <QuickActionTile description="ย้อนหลังทุกเดือน" icon={History} label="ประวัติการชำระ" tone="neutral" to="/payments/history" />
              <QuickActionTile description="รายรับ-รายจ่ายหมู่บ้าน" icon={ChartColumn} label="รายงานการเงิน" tone="neutral" to="/reports" />
              {hotlines.length > 0 && <QuickActionTile description="ติดต่อเจ้าหน้าที่" icon={Phone} label="เบอร์โทรด่วน" tone="danger" to="#hotlines" />}
            </section>
            {(villageSummary || balance !== null) && (
            <VillageCard balance={balance} className="order-3 xl:order-2" month={month} summary={villageSummary} />
            )}
          </div>
          {error && <p className="text-body text-danger">{error}</p>}
          <div className="grid gap-6 xl:grid-cols-12">
            <AnnouncementsCard announcements={announcements} />
            <div className="xl:col-span-5">
              <QuickCallBar />
            </div>
          </div>
        </>
      )}
    </div>
  )
}

function BillCard({ bill, loading, month }: { bill: Bill | null; loading: boolean; month: string }) {
  const overdue = bill?.status === 'unpaid' && getDueCountdown(bill.due_date).overdue
  const panelClass = !bill
    ? 'bg-surface-low'
    : bill.status === 'pending_review'
      ? 'bg-surface-low'
      : bill.status === 'paid' || bill.status === 'waived'
        ? 'bg-tint-success'
        : overdue ? 'bg-tint-danger' : 'bg-tint-warning'

  return (
    <Card className="order-1 grid gap-5 rounded-xl p-6 shadow-raised xl:order-1 xl:col-span-8 xl:p-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <IconTile icon={Receipt} size="M" tone="primary" />
          <h2 className="font-display text-h2 font-semibold text-text-heading">ค่าส่วนกลาง {month}</h2>
        </div>
        {bill && <StatusBadge dueDate={bill.due_date} status={bill.status} />}
      </div>
      {loading ? <Spinner /> : (
        <div className={`grid gap-3 rounded-lg p-4 sm:p-6 ${panelClass}`}>
          {!bill ? (
            <p className="text-body-lg font-semibold text-text-heading">ยังไม่มีบิลเดือนนี้</p>
          ) : (
            <>
              <p className="text-base leading-6 font-semibold text-text-muted">ยอดที่ต้องชำระ</p>
              <div className="flex flex-wrap items-end justify-between gap-3">
                <p className={`font-display text-display font-bold tabular-nums ${bill.status === 'paid' || bill.status === 'waived' ? 'text-primary' : 'text-text-heading'}`}>
                  {formatAmount(bill.amount)} <span className="text-[18px] leading-7 text-body">บาท</span>
                </p>
                {(bill.status === 'paid' || bill.status === 'waived') && <CheckCircle2 aria-hidden="true" className="mb-2 text-primary" size={32} />}
              </div>
              {bill.status === 'pending_review' && <p className="text-body text-text-heading">ส่งสลิปแล้ว รอกรรมการตรวจสอบ</p>}
              {bill.status === 'unpaid' && <DueChip dueDate={bill.due_date} overdue={overdue} />}
            </>
          )}
          {bill?.status === 'unpaid' && (
            <Link className="mt-2 inline-flex min-h-14 w-full items-center justify-center gap-2 rounded-md bg-primary-container px-6 text-[18px] leading-7 font-semibold text-white shadow-card transition duration-150 hover:bg-primary active:scale-[0.98] active:bg-primary-pressed sm:w-fit" to="/payments/upload">
              <Receipt aria-hidden="true" size={22} />
              ส่งสลิป
            </Link>
          )}
          {bill && bill.status !== 'unpaid' && (
            <Link className="mt-2 inline-flex min-h-control items-center justify-center gap-2 rounded-md bg-surface-high px-6 text-[18px] leading-7 font-semibold text-primary transition hover:bg-surface-highest" to="/payments/history">
              ดูประวัติการชำระ
            </Link>
          )}
        </div>
      )}
    </Card>
  )
}

function DueChip({ dueDate, overdue }: { dueDate: string; overdue: boolean }) {
  const countdown = getDueCountdown(dueDate)
  const label = countdown.days === 0 && !overdue
    ? 'ครบกำหนดวันนี้'
    : overdue
      ? countdown.label
      : `ครบกำหนด ${formatDateTH(dueDate)} (${countdown.label})`
  return (
    <p className={`inline-flex min-h-8 w-fit items-center gap-2 rounded-sm px-2.5 text-base leading-6 font-semibold ${overdue ? 'bg-status-danger-bg text-status-danger-fg' : 'bg-status-warning-bg text-status-warning-fg'}`}>
      <CalendarClock aria-hidden="true" size={20} />
      {label}
    </p>
  )
}

function VillageCard({ balance, className = '', month, summary }: { balance: number | null; className?: string; month: string; summary: VillagePaymentSummary | null }) {
  const houses = summary ? residentRoofline(summary, summary.my_status) : []
  return (
    <Card className={`grid content-start gap-4 xl:col-span-4 ${className}`}>
      <div className="flex items-center gap-3">
        <IconTile icon={House} size="M" tone="primary" />
        <h2 className="font-display text-h2 font-semibold text-text-heading">หมู่บ้านเรา เดือน {month}</h2>
      </div>
      {summary && (
        <>
          <Roofline
            counts={{ paid: summary.paid, pending: summary.pending_review, unpaid: summary.unpaid }}
            houses={houses}
          />
          <p className="font-display text-h2 font-semibold text-text-heading">ชำระแล้ว {summary.paid} จาก {summary.total} หลัง</p>
        </>
      )}
      {balance !== null && (
        <>
          <div className="rounded-lg bg-surface-low p-4">
            <div className="flex items-center gap-3">
              <IconTile icon={PiggyBank} size="M" tone="primary" />
              <div>
                <p className="text-body text-text-muted">ยอดเงินหมู่บ้านคงเหลือ</p>
                <p className="font-display text-h2 font-bold tabular-nums text-text-heading">฿{formatAmount(balance)}</p>
              </div>
            </div>
          </div>
          <Link className="inline-flex min-h-touch items-center gap-2 rounded-md px-3 font-semibold text-primary hover:bg-surface-low" to="/reports">
            ดูรายงานการเงิน
          </Link>
        </>
      )}
    </Card>
  )
}

function AnnouncementsCard({ announcements }: { announcements: Announcement[] }) {
  return (
    <Card className="grid content-start gap-4 xl:col-span-7">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <IconTile icon={Megaphone} size="M" tone="secondary" />
          <h2 className="font-display text-h2 font-semibold text-text-heading">ประกาศล่าสุด</h2>
        </div>
        <Link className="inline-flex min-h-touch items-center rounded-md px-3 font-semibold text-primary hover:bg-surface-low" to="/announcements">ดูทั้งหมด</Link>
      </div>
      {announcements.length ? (
        <div className="grid gap-4">
          {announcements.map((item) => (
            <article className={`grid gap-3 border-b border-outline-soft pb-4 last:border-0 last:pb-0 ${item.signed_url ? 'sm:grid-cols-[7rem_minmax(0,1fr)]' : ''}`} key={item.id}>
              {item.signed_url && <img alt={`รูปประกาศ: ${item.title}`} className="aspect-video w-full rounded-md object-cover sm:size-28" src={item.signed_url} />}
              <div className="min-w-0">
                {item.is_pinned && <span className="mb-2 inline-flex items-center gap-1.5 rounded-sm bg-tint-warning px-2 py-1 text-caption font-semibold text-secondary"><Pin aria-hidden="true" size={16} />ปักหมุด</span>}
                <h3 className="line-clamp-2 text-h3 font-bold text-text-heading">{item.title}</h3>
                <p className="mt-1 line-clamp-2 text-body text-text-muted">{item.body}</p>
                <p className="mt-2 flex items-center gap-1.5 text-caption text-text-muted"><Clock aria-hidden="true" size={16} />{formatDateTH(item.created_at)}</p>
              </div>
            </article>
          ))}
        </div>
      ) : <p className="text-body text-text-muted">ยังไม่มีประกาศใหม่</p>}
    </Card>
  )
}

function QuickActionTile({ description, icon: Icon, label, tone, to }: {
  description: string
  icon: typeof Wrench
  label: string
  tone: 'primary' | 'secondary' | 'neutral' | 'danger'
  to: string
}) {
  const content = (
    <Card className="flex h-full min-h-28 flex-col justify-between gap-3 p-4 transition duration-150 hover:shadow-raised active:scale-[0.98]">
      <div className="flex items-start justify-between gap-2">
        <IconTile icon={Icon} size="L" tone={tone} />
        <ChevronRight aria-hidden="true" className="text-text-muted" size={24} />
      </div>
      <div>
        <h3 className="text-h3 font-bold text-text-heading">{label}</h3>
        <p className="line-clamp-2 text-body text-text-muted">{description}</p>
      </div>
    </Card>
  )
  return to.startsWith('#')
    ? <a className="min-w-0" href={to}>{content}</a>
    : <Link className="min-w-0" to={to}>{content}</Link>
}

function SummaryTile({ icon, label, value, to, tone }: {
  icon: typeof Wrench
  label: string
  value: number | string
  to: string
  tone: 'primary' | 'secondary'
}) {
  return (
    <Link to={to}>
      <Card className="flex h-full items-center gap-3 p-4 transition duration-150 hover:shadow-raised">
        <IconTile icon={icon} size="L" tone={tone} />
        <div className="min-w-0">
          <p className="text-body text-text-muted">{label}</p>
          <p className="font-display text-h2 font-bold tabular-nums text-text-heading">{value}</p>
        </div>
      </Card>
    </Link>
  )
}

function CommitteeRoofline({ houses }: { houses: MonthPaymentStatus[] }) {
  const counts = houses.reduce((current, house) => {
    if (house.state === 'paid') current.paid += 1
    else if (house.state === 'pending') current.pending += 1
    else current.unpaid += 1
    return current
  }, { paid: 0, pending: 0, unpaid: 0 })
  return (
    <Roofline
      counts={counts}
      houses={houses.map((house) => ({
        key: house.house_no,
        state: house.state === 'pending' ? 'pending' : house.state,
      }))}
    />
  )
}

function PmSection({ assets, title, tone }: { assets: CommitteeDashboard['pm_overdue']; title: string; tone: 'danger' | 'warning' }) {
  const Icon = tone === 'danger' ? TriangleAlert : CalendarClock
  return (
    <Card>
      <div className="mb-3 flex items-center gap-3">
        <IconTile icon={Icon} size="M" tone={tone === 'danger' ? 'danger' : 'secondary'} />
        <h2 className="font-display text-h2 font-semibold text-text-heading">{title}</h2>
      </div>
      {assets.length ? (
        <ul className="grid gap-2">
          {assets.map((asset) => (
            <li key={asset.id}>
              <Link className="flex min-h-touch flex-wrap items-center justify-between gap-2 rounded-md px-2 py-1 hover:bg-surface-low" to={`/assets/${asset.id}`}>
                <span className="font-semibold text-text-heading">{asset.name}</span>
                <PmBadge nextDueDate={asset.next_due_date} />
              </Link>
            </li>
          ))}
        </ul>
      ) : <p className="text-body text-text-muted">ไม่มีอุปกรณ์ในรายการนี้</p>}
    </Card>
  )
}
