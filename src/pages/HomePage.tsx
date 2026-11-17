import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import { ArrowRight, Banknote, CalendarDays, ClipboardCheck, History, Upload, Wrench } from 'lucide-react'
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

type Summary = { pendingSlips: number; paid: number; pending: number; unpaid: number }

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
  const [summary, setSummary] = useState<Summary>({ pendingSlips: 0, paid: 0, pending: 0, unpaid: 0 })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [generating, setGenerating] = useState(false)
  const [refreshKey, setRefreshKey] = useState(0)
  const { showToast } = useToast()
  const offline = useOffline()
  const period = currentPeriod()

  useEffect(() => {
    let active = true
    if (!supabase) return
    async function load() {
      try {
        if (committee) {
          const [billsResult, slipsResult] = await Promise.all([
            supabase!.from('bills').select('status').eq('period', period),
            supabase!.from('slips').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
          ])
          if (billsResult.error) throw billsResult.error
          if (slipsResult.error) throw slipsResult.error
          const statuses = billsResult.data ?? []
          if (active) setSummary({
            pendingSlips: slipsResult.count ?? 0,
            paid: statuses.filter((item) => item.status === 'paid').length,
            pending: statuses.filter((item) => item.status === 'pending_review').length,
            unpaid: statuses.filter((item) => item.status === 'unpaid').length,
          })
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
          {loading ? <Spinner /> : (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <Link to="/admin/slips"><Card className="h-full border-primary-200 bg-primary-50"><p className="text-body text-primary-900">สลิปรอตรวจ</p><p className="mt-2 text-display font-bold text-primary-700">{summary.pendingSlips} รายการ</p><span className="mt-2 flex items-center gap-2 font-semibold text-primary-700">ตรวจสลิป <ArrowRight size={18} /></span></Card></Link>
              <SummaryCard label="ชำระแล้ว" value={summary.paid} tone="success" />
              <SummaryCard label="รอตรวจสอบ" value={summary.pending} tone="warning" />
              <SummaryCard label="รอชำระ" value={summary.unpaid} tone="neutral" />
            </div>
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

function SummaryCard({ label, value, tone }: { label: string; value: number; tone: 'success' | 'warning' | 'neutral' }) {
  const style = {
    success: 'border-status-success-border bg-status-success-bg text-status-success-fg',
    warning: 'border-status-warning-border bg-status-warning-bg text-status-warning-fg',
    neutral: 'border-status-neutral-border bg-status-neutral-bg text-status-neutral-fg',
  }[tone]
  return <Card className={`border ${style}`}><p className="text-body">{label}</p><p className="mt-2 text-display font-bold">{value} หลัง</p></Card>
}
