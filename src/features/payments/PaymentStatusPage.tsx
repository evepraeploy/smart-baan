import { useCallback, useEffect, useMemo, useState } from 'react'
import { Calendar, CircleCheck, CircleDashed, Clock, TriangleAlert } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { Card } from '../../components/ui/Card'
import { Select } from '../../components/ui/Select'
import { Spinner } from '../../components/ui/Spinner'
import { currentBangkokDate, currentBangkokYear } from '../../lib/date'
import { formatDateTH } from '../../lib/format'
import { compareHouseNo } from '../../lib/house-number'
import { toThaiError } from '../../lib/errors'
import { getPaymentStatusData, type PaymentStatusBill } from './statusApi'

const monthNames = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.']

type CellStatus = 'paid' | 'pending_review' | 'overdue' | 'unpaid' | 'waived' | 'none'

function statusOf(bill: PaymentStatusBill | undefined, today: string): CellStatus {
  if (!bill) return 'none'
  if (bill.status === 'paid') return 'paid'
  if (bill.status === 'pending_review') return 'pending_review'
  if (bill.status === 'waived') return 'waived'
  return bill.due_date < today ? 'overdue' : 'unpaid'
}

const statusStyle: Record<CellStatus, { label: string; Icon: LucideIcon; className: string }> = {
  paid: { label: 'จ่ายแล้ว', Icon: CircleCheck, className: 'border-status-success-border bg-status-success-bg text-status-success-fg' },
  pending_review: { label: 'รอตรวจ', Icon: Clock, className: 'border-status-warning-border bg-status-warning-bg text-status-warning-fg' },
  overdue: { label: 'ค้าง', Icon: TriangleAlert, className: 'border-status-danger-border bg-status-danger-bg text-status-danger-fg' },
  unpaid: { label: 'รอชำระ', Icon: Calendar, className: 'border-status-neutral-border bg-status-neutral-bg text-status-neutral-fg' },
  waived: { label: 'ยกเว้น', Icon: CircleDashed, className: 'border-status-neutral-border bg-status-neutral-bg text-status-neutral-fg' },
  none: { label: '—', Icon: CircleDashed, className: 'border-status-neutral-border bg-white text-text-muted' },
}

export function PaymentStatusPage() {
  const currentYear = currentBangkokYear()
  const [year, setYear] = useState(currentYear)
  const [houses, setHouses] = useState<{ id: string; house_no: string }[]>([])
  const [bills, setBills] = useState<PaymentStatusBill[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const today = currentBangkokDate()

  const refresh = useCallback(async () => {
    setLoading(true)
    try {
      const result = await getPaymentStatusData(year)
      setHouses(result.houses.sort((a, b) => compareHouseNo(a.house_no, b.house_no)))
      setBills(result.bills)
      setError('')
    } catch (caught) {
      setError(toThaiError(caught))
    } finally {
      setLoading(false)
    }
  }, [year])
  useEffect(() => { void refresh() }, [refresh])

  const billByHouseMonth = useMemo(() => {
    const result = new Map<string, PaymentStatusBill>()
    for (const bill of bills) result.set(`${bill.house_id}:${bill.period.slice(0, 7)}`, bill)
    return result
  }, [bills])
  const paidCounts = useMemo(() => monthNames.map((_, monthIndex) => {
    const month = `${year}-${String(monthIndex + 1).padStart(2, '0')}`
    return bills.filter((bill) => bill.period.startsWith(month) && bill.status === 'paid').length
  }), [bills, year])
  const years = Array.from({ length: 5 }, (_, index) => currentYear - 3 + index)

  return (
    <div className="grid gap-5">
      <div>
        <h1 className="text-h1 font-bold text-text-heading">สถานะการจ่ายทั้งหมู่บ้าน</h1>
        <p className="text-body text-text-muted">ตรวจสอบสถานะค่าส่วนกลางรายบ้านและรายเดือน</p>
      </div>
      <Card className="grid gap-2 sm:max-w-xs">
        <label className="grid gap-2 text-body font-semibold text-text-heading">
          ปี พ.ศ.
          <Select onChange={(event) => setYear(Number(event.target.value))} value={year}>
            {years.map((option) => <option key={option} value={option}>{option + 543}</option>)}
          </Select>
        </label>
      </Card>
      <Card className="min-w-0">
        <div className="mb-4 flex flex-wrap gap-2" aria-label="คำอธิบายสถานะ">
          {(['paid', 'pending_review', 'overdue', 'unpaid', 'waived', 'none'] as CellStatus[]).map((status) => {
            const { label, Icon, className } = statusStyle[status]
            return <span className={`inline-flex min-h-8 items-center gap-1 rounded-full border px-3 text-caption font-semibold ${className}`} key={status}><Icon aria-hidden="true" size={16} />{status === 'none' ? 'ไม่มีบิล' : label}</span>
          })}
        </div>
        {error && <p aria-live="polite" className="mb-3 rounded-md bg-red-50 p-3 text-body text-red-700">{error}</p>}
        {loading ? <Spinner /> : (
          <div className="max-w-full overflow-x-auto overscroll-x-contain">
            <table className="min-w-[1040px] border-collapse text-body">
              <thead>
                <tr className="bg-subtle text-text-heading">
                  <th className="sticky left-0 top-0 z-30 min-w-32 border-b border-border bg-subtle p-3 text-left font-semibold">บ้านเลขที่</th>
                  {monthNames.map((month) => <th className="sticky top-0 z-20 min-w-20 border-b border-border bg-subtle p-3 text-center font-semibold" key={month}>{month}</th>)}
                </tr>
              </thead>
              <tbody>
                {houses.map((house, rowIndex) => (
                  <tr className={rowIndex % 2 ? 'bg-subtle/60' : 'bg-white'} key={house.id}>
                    <th className={`sticky left-0 z-10 min-w-32 border-b border-border p-3 text-left font-semibold text-text-heading ${rowIndex % 2 ? 'bg-subtle' : 'bg-white'}`}>{house.house_no}</th>
                    {monthNames.map((_, monthIndex) => {
                      const month = `${year}-${String(monthIndex + 1).padStart(2, '0')}`
                      const bill = billByHouseMonth.get(`${house.id}:${month}`)
                      return <td className="border-b border-border p-2 text-center" key={month}><PaymentCell bill={bill} status={statusOf(bill, today)} /></td>
                    })}
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-subtle text-text-heading">
                  <th className="sticky bottom-0 left-0 z-20 border-t border-border bg-subtle p-3 text-left font-semibold">จ่ายแล้ว</th>
                  {paidCounts.map((count, monthIndex) => <td className="border-t border-border p-3 text-center font-semibold tabular-nums" key={monthNames[monthIndex]}>{count}</td>)}
                </tr>
              </tfoot>
            </table>
            {!houses.length && <p className="p-4 text-body text-text-muted">ยังไม่มีบ้านที่เปิดใช้งาน</p>}
          </div>
        )}
      </Card>
    </div>
  )
}

function PaymentCell({ bill, status }: { bill: PaymentStatusBill | undefined; status: CellStatus }) {
  const { label, Icon, className } = statusStyle[status]
  return (
    <span className={`inline-flex min-h-8 items-center justify-center gap-1 rounded-full border px-2 text-caption font-semibold ${className}`} title={bill ? `${label} · ครบกำหนด ${formatDateTH(bill.due_date)}` : 'ไม่มีบิล'}>
      <Icon aria-hidden="true" size={16} />
      <span>{label}</span>
    </span>
  )
}
