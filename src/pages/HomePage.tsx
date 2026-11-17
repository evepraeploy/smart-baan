import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import { Banknote, CalendarDays, ClipboardCheck, History, Upload, Wrench } from 'lucide-react'
import { Button } from '../components/ui/Button'
import { Card } from '../components/ui/Card'
import { StatusBadge } from '../components/ui/Badge'
import { Spinner } from '../components/ui/Spinner'
import { QuickCallBar } from '../components/layout/QuickCallBar'
import { useOffline } from '../components/layout/OfflineBanner'
import { useToast } from '../components/ui/Toast'
import { useAuth } from '../features/auth/AuthProvider'
import { supabase } from '../lib/supabase'
import { formatBaht, formatDateTH, formatMonthTH } from '../lib/format'
import { toThaiError } from '../lib/errors'
import { messages } from '../lib/messages.th'
import type { Bill } from '../features/payments/api'
import { getCommitteeDashboard, type CommitteeDashboard } from '../features/assets/api'
import { PmBadge } from '../features/assets/AssetsPage'

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

export function HomePage() {
  const { roles, house, profile } = useAuth()
  const committee = roles.includes('committee') || roles.includes('admin')
  const [bill, setBill] = useState<Bill | null>(null)
  const [committeeDashboard, setCommitteeDashboard] = useState<CommitteeDashboard | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [generating, setGenerating] = useState(false)
  const [refreshKey, setRefreshKey] = useState(0)
  const { showToast } = useToast()
  const offline = useOffline()
  const period = currentPeriod()

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
          const { data, error: queryError } = await supabase!.from('bills').select('id,house_id,period,amount,due_date,status,paid_at').eq('house_id', house.id).eq('period', period).maybeSingle()
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

  return (
    <div className="grid gap-6">
      {!committee && <div className="rounded-xl bg-primary-900 p-5 text-white sm:p-7">
        <p className="text-body-lg text-primary-100">ยินดีต้อนรับ</p>
        <h1 className="mt-1 text-h1 font-bold">{profile?.display_name}</h1>
        <p className="mt-1 text-body text-primary-100">บ้านเลขที่ {house?.house_no ?? '—'}</p>
      </div>}
      {committee ? (
        <>
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div><h1 className="text-h1 font-bold text-text-heading">ภาพรวมหมู่บ้าน</h1><p className="text-body text-text-muted">สถานะค่าส่วนกลาง {formatMonthTH(period)}</p></div>
            <div className="grid gap-1">
              <Button busy={generating} disabled={offline} onClick={() => void generateBills()} variant="secondary">สร้างบิลเดือนนี้</Button>
              {offline && <span className="text-caption text-amber-800">{messages.offlineBills}</span>}
            </div>
          </div>
          {loading ? <Spinner /> : committeeDashboard ? (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <FinanceSummaryCard label="ยอดคงเหลือ" value={committeeDashboard?.balance ?? 0} to="/reports" />
              <FinanceSummaryCard label="รายรับเดือนนี้" value={committeeDashboard?.month_income ?? 0} to="/finance" tone="success" />
              <FinanceSummaryCard label="รายจ่ายเดือนนี้" value={committeeDashboard?.month_expense ?? 0} to="/finance" tone="danger" />
              <CountCard label="สลิปรอตรวจ" value={committeeDashboard?.pending_slips ?? 0} to="/admin/slips" />
              <CountCard label="งานซ่อมค้าง" value={committeeDashboard?.open_tickets ?? 0} to="/maintenance" detail={committeeDashboard ? `รอรับเรื่อง ${committeeDashboard.tickets_by_status.pending} · กำลังดำเนินการ ${committeeDashboard.tickets_by_status.in_progress}` : undefined} />
            </div>
          ) : error ? null : <Card><p className="text-body text-text-muted">ยังไม่มีข้อมูล Dashboard</p></Card>}
          {committeeDashboard && (
            <>
              <div className="grid gap-3 sm:grid-cols-3">
                <CountCard label="ชำระแล้ว" value={committeeDashboard.bills_this_month.paid} to="/admin/payment-status" tone="success" />
                <CountCard label="รอตรวจสอบ" value={committeeDashboard.bills_this_month.pending_review} to="/admin/payment-status" tone="warning" />
                <CountCard label="รอชำระ" value={committeeDashboard.bills_this_month.unpaid} to="/admin/payment-status" tone="neutral" />
              </div>
              <section className="grid gap-4 lg:grid-cols-2">
                <PmSection assets={committeeDashboard.pm_overdue} title="เลยกำหนด PM" tone="danger" />
                <PmSection assets={committeeDashboard.pm_due_soon} title="PM ใน 14 วัน" tone="warning" />
              </section>
            </>
          )}
          {error && <p className="text-body text-red-700">{error}</p>}
          <div className="grid gap-4 sm:grid-cols-2">
            <Link to="/admin/slips"><Card className="flex min-h-touch items-center gap-3 text-h3 font-semibold text-text-heading"><ClipboardCheck className="text-primary-700" size={24} />ตรวจสลิปที่ส่งเข้ามา</Card></Link>
            <Link to="/finance"><Card className="flex min-h-touch items-center gap-3 text-h3 font-semibold text-text-heading"><Banknote className="text-primary-700" size={24} />ดูรายการการเงิน</Card></Link>
          </div>
        </>
      ) : (
        <>
          <div><h2 className="text-h2 font-bold text-text-heading">ค่าส่วนกลางเดือนนี้</h2><p className="text-body text-text-muted">{formatMonthTH(period)}</p></div>
          {loading ? <Spinner /> : bill ? (
            <Card className="grid gap-5 rounded-xl border-primary-200 bg-white p-5 sm:p-7">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div><p className="text-body text-text-muted">ยอดชำระ</p><p className="mt-1 text-display font-bold text-text-heading">{formatBaht(bill.amount)}</p></div>
                <StatusBadge dueDate={bill.due_date} status={bill.status} />
              </div>
              <p className="flex items-center gap-2 text-body text-text-muted"><CalendarDays size={20} />ครบกำหนด {formatDateTH(bill.due_date)}</p>
              {bill.status !== 'paid' && bill.status !== 'waived' && <Link className="inline-flex min-h-control w-full items-center justify-center gap-2 rounded-md bg-primary-700 px-5 font-semibold text-white hover:bg-primary-800 sm:w-auto" to="/payments/upload"><Upload size={21} />ส่งสลิป</Link>}
            </Card>
          ) : <Card><p className="text-body text-text-muted">ยังไม่มีบิลของเดือนนี้</p></Card>}
          {error && <p className="text-body text-red-700">{error}</p>}
          <div className="grid gap-4 sm:grid-cols-2">
            <Link to="/payments/history"><Card className="flex min-h-touch items-center gap-3 text-h3 font-semibold text-text-heading"><History className="text-primary-700" size={24} />ประวัติการชำระ</Card></Link>
            <Link to="/repairs"><Card className="flex min-h-touch items-center gap-3 text-h3 font-semibold text-text-heading"><Wrench className="text-primary-700" size={24} />แจ้งซ่อม</Card></Link>
          </div>
          <QuickCallBar />
        </>
      )}
    </div>
  )
}

function FinanceSummaryCard({ label, value, to, tone = 'neutral' }: { label: string; value: number; to: string; tone?: 'neutral' | 'success' | 'danger' }) {
  const color = tone === 'success'
    ? 'text-status-success-fg'
    : tone === 'danger' ? 'text-status-danger-fg' : 'text-text-heading'
  return (
    <Link to={to}>
      <Card className="h-full hover:border-primary-700">
        <p className="text-body text-text-muted">{label}</p>
        <p className={`mt-2 text-h2 font-bold tabular-nums ${color}`}>{formatBaht(value)}</p>
      </Card>
    </Link>
  )
}

function CountCard({ label, value, to, detail, tone = 'neutral' }: { label: string; value: number; to: string; detail?: string; tone?: 'neutral' | 'success' | 'warning' }) {
  const color = tone === 'success' ? 'text-status-success-fg' : tone === 'warning' ? 'text-status-warning-fg' : 'text-text-heading'
  return <Link to={to}><Card className="h-full hover:border-primary-700"><p className="text-body text-text-muted">{label}</p><p className={`mt-2 text-display font-bold ${color}`}>{value}</p>{detail && <p className="mt-1 text-caption text-text-muted">{detail}</p>}</Card></Link>
}

function PmSection({ assets, title, tone }: { assets: CommitteeDashboard['pm_overdue']; title: string; tone: 'danger' | 'warning' }) {
  return <Card className={`border-l-4 ${tone === 'danger' ? 'border-l-status-danger-fg' : 'border-l-status-warning-fg'}`}>
    <h2 className="mb-3 text-h2 font-bold text-text-heading">{title}</h2>
    {assets.length ? <ul className="grid gap-2">{assets.map((asset) => <li key={asset.id}><Link className="flex min-h-touch flex-wrap items-center justify-between gap-2 rounded-md px-2 py-1 hover:bg-subtle" to={`/assets/${asset.id}`}><span className="font-semibold text-text-heading">{asset.name}</span><PmBadge nextDueDate={asset.next_due_date} /></Link></li>)}</ul> : <p className="text-body text-text-muted">ไม่มีอุปกรณ์ในรายการนี้</p>}
  </Card>
}
