import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import { CalendarDays, ReceiptText } from 'lucide-react'
import { Card } from '../../components/ui/Card'
import { EmptyState } from '../../components/ui/EmptyState'
import { SlipStatusBadge, StatusBadge } from '../../components/ui/Badge'
import { Spinner } from '../../components/ui/Spinner'
import { useAuth } from '../auth/AuthProvider'
import { supabase } from '../../lib/supabase'
import { formatBaht, formatDateTH, formatMonthTH } from '../../lib/format'
import { toThaiError } from '../../lib/errors'
import { messages } from '../../lib/messages.th'

type HistoryBill = {
  id: string
  period: string
  amount: number
  due_date: string
  status: 'unpaid' | 'pending_review' | 'paid' | 'waived'
  slip_bills: { slips: { id: string; status: 'pending' | 'approved' | 'rejected'; reject_reason: string | null } | null }[]
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
          .select('id,period,amount,due_date,status,slip_bills(slips(id,status,reject_reason))')
          .eq('house_id', house.id)
          .order('period', { ascending: false })
        if (!active) return
        if (queryError) setError(toThaiError(queryError))
        else setItems((data ?? []) as unknown as HistoryBill[])
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
  if (error) return <Card><p className="text-body text-red-700">{error}</p></Card>
  if (!items.length) return <Card><EmptyState description="รายการบิลและสถานะจะปรากฏที่นี่" icon={ReceiptText} title="ยังไม่มีประวัติการชำระ" /></Card>

  return (
    <div className="grid gap-4">
      <h1 className="text-h1 font-bold text-text-heading">ประวัติการชำระ</h1>
      {items.map((bill) => {
        const slips = (bill.slip_bills ?? []).map((link) => link.slips).filter((slip): slip is NonNullable<typeof slip> => Boolean(slip))
        const rejected = slips.find((slip) => slip.status === 'rejected')
        return (
          <Card className="grid gap-4" key={bill.id}>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="text-h3 font-bold text-text-heading">ค่าส่วนกลาง {formatMonthTH(bill.period)}</h2>
                <p className="mt-1 flex items-center gap-2 text-body text-text-muted"><CalendarDays size={18} />ครบกำหนด {formatDateTH(bill.due_date)}</p>
              </div>
              <StatusBadge dueDate={bill.due_date} status={bill.status} />
            </div>
            <p className="text-h2 font-bold text-text-heading">{formatBaht(bill.amount)}</p>
            {slips.map((slip) => <SlipStatusBadge key={slip.id} status={slip.status} />)}
            {rejected?.reject_reason && <div className="rounded-md bg-red-50 p-3 text-body text-red-700"><strong>เหตุผลที่ไม่ผ่าน:</strong> {rejected.reject_reason}</div>}
            {rejected && <Link className="inline-flex min-h-control w-full items-center justify-center rounded-md border border-primary-700 px-5 font-semibold text-primary-700 hover:bg-primary-50 sm:w-auto" to={`/payments/upload?bill=${bill.id}`}>ส่งสลิปใหม่</Link>}
          </Card>
        )
      })}
    </div>
  )
}
