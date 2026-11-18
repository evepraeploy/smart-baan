import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import { CalendarDays, ReceiptText } from 'lucide-react'
import { Card } from '../../components/ui/Card'
import { EmptyState } from '../../components/ui/EmptyState'
import { StatusBadge } from '../../components/ui/Badge'
import { IconTile } from '../../components/ui/IconTile'
import { SlipList } from '../../components/slips/SlipList'
import { Spinner } from '../../components/ui/Spinner'
import { useAuth } from '../auth/AuthProvider'
import { supabase } from '../../lib/supabase'
import { formatBaht, formatDateTH, formatMonthTH } from '../../lib/format'
import { toThaiError } from '../../lib/errors'
import { messages } from '../../lib/messages.th'
import { getBillDisplayStatus } from '../../lib/bill-status'
import { signSlipUrls, type SlipRecord } from './slipsApi'

type HistoryBill = {
  id: string
  period: string
  amount: number
  due_date: string
  status: 'unpaid' | 'pending_review' | 'paid' | 'waived'
  slip_bills: { slips: SlipRecord | null }[] | null
  slips: SlipRecord[]
}

export function PaymentHistoryPage() {
  const { house } = useAuth()
  const [items, setItems] = useState<HistoryBill[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true
    if (!house) {
      setItems([])
      setLoading(false)
      return () => { active = false }
    }
    if (!supabase) {
      setError(messages.generic)
      setLoading(false)
      return () => { active = false }
    }
    setLoading(true)
    setError('')
    void (async () => {
      try {
        const { data, error: queryError } = await supabase
          .from('bills')
          .select('id,period,amount,due_date,status,slip_bills(slips(id,status,reject_reason,amount,transferred_at,created_at,file_path))')
          .eq('house_id', house.id)
          .order('period', { ascending: false })
        if (!active) return
        if (queryError) setError(toThaiError(queryError))
        else {
          const bills = (data ?? []) as unknown as HistoryBill[]
          const slips = await signSlipUrls(bills.flatMap((bill) => (bill.slip_bills ?? []).map((link) => link.slips).filter((slip): slip is SlipRecord => Boolean(slip))))
          if (!active) return
          const slipById = new Map(slips.map((slip) => [slip.id, slip]))
          setItems(bills.map((bill) => ({
            ...bill,
            slips: (bill.slip_bills ?? [])
              .map((link) => link.slips)
              .filter((slip): slip is SlipRecord => Boolean(slip))
              .map((slip) => slipById.get(slip.id) ?? slip),
          })))
        }
      } catch (caught) {
        if (active) setError(toThaiError(caught))
      } finally {
        if (active) setLoading(false)
      }
    })()
    return () => { active = false }
  }, [house])

  if (loading) return <Spinner />
  if (!house) {
    return <Card><EmptyState description="บัญชีนี้ไม่ได้ผูกกับบ้าน จึงดูประวัติการชำระไม่ได้" icon={ReceiptText} title="ไม่พบข้อมูลบ้าน" /></Card>
  }
  if (error) return <Card><p className="text-body text-danger">{error}</p></Card>
  if (!items.length) return <Card><EmptyState description="รายการบิลและสถานะจะปรากฏที่นี่" icon={ReceiptText} title="ยังไม่มีประวัติการชำระ" /></Card>

  return (
    <div className="grid gap-4">
      <h1 className="font-display text-h1 font-bold text-text-heading">ประวัติการชำระ</h1>
      {items.map((bill) => {
        const hasRejected = bill.slips.some((slip) => slip.status === 'rejected')
        const display = getBillDisplayStatus(bill.status, bill.due_date)
        const tileTone = display.tone === 'success' ? 'primary' : display.tone === 'warning' ? 'secondary' : display.tone === 'danger' ? 'danger' : 'neutral'
        return (
          <Card className="grid gap-4" key={bill.id}>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div className="flex min-w-0 items-center gap-3">
                <IconTile icon={display.icon} size="L" tone={tileTone} />
                <div className="min-w-0">
                  <h2 className="break-words font-display text-h3 font-bold text-text-heading">ค่าส่วนกลาง {formatMonthTH(bill.period)}</h2>
                  <p className="mt-1 flex items-center gap-2 text-body text-text-muted"><CalendarDays aria-hidden="true" className="shrink-0" size={18} />ครบกำหนด {formatDateTH(bill.due_date)}</p>
                </div>
              </div>
              <StatusBadge className="w-fit" dueDate={bill.due_date} status={bill.status} />
            </div>
            <p className="font-display text-h2 font-bold text-text-heading">{formatBaht(bill.amount)}</p>
            <SlipList houseNo={house.house_no} period={bill.period} slips={bill.slips} />
            {hasRejected && <Link className="inline-flex min-h-control w-full items-center justify-center rounded-md border-2 border-primary-container bg-white px-6 text-[18px] leading-7 font-semibold text-primary hover:bg-surface-low sm:w-auto" to={`/payments/upload?bill=${bill.id}`}>ส่งสลิปใหม่</Link>}
          </Card>
        )
      })}
    </div>
  )
}
