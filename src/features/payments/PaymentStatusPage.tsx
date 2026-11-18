import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ChevronRight, CircleCheck, CircleDashed, Clock, Image, TriangleAlert } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { Card } from '../../components/ui/Card'
import { Modal } from '../../components/ui/Modal'
import { Select } from '../../components/ui/Select'
import { SlipList } from '../../components/slips/SlipList'
import { Spinner } from '../../components/ui/Spinner'
import { StatusBadge } from '../../components/ui/Badge'
import { currentBangkokDate, currentBangkokYear } from '../../lib/date'
import { formatBaht, formatDateTH, formatMonthTH } from '../../lib/format'
import { compareHouseNo } from '../../lib/house-number'
import { toThaiError } from '../../lib/errors'
import { getBillWithSlips, type BillWithSlips } from './slipsApi'
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
  paid: { label: 'จ่ายแล้ว', Icon: CircleCheck, className: 'bg-status-success-bg text-status-success-fg' },
  pending_review: { label: 'รอตรวจ', Icon: Clock, className: 'bg-status-warning-bg text-status-warning-fg' },
  overdue: { label: 'ค้าง', Icon: TriangleAlert, className: 'bg-status-danger-bg text-status-danger-fg' },
  unpaid: { label: 'รอชำระ', Icon: Clock, className: 'bg-status-warning-bg text-status-warning-fg' },
  waived: { label: 'ยกเว้น', Icon: CircleDashed, className: 'bg-status-neutral-bg text-status-neutral-fg' },
  none: { label: 'ไม่มีบิล', Icon: CircleDashed, className: 'bg-surface-low text-text-muted' },
}

export function PaymentStatusPage() {
  const currentYear = currentBangkokYear()
  const currentMonth = currentBangkokDate().slice(5, 7)
  const [year, setYear] = useState(currentYear)
  const [selectedMonth, setSelectedMonth] = useState(currentMonth)
  const [houses, setHouses] = useState<{ id: string; house_no: string }[]>([])
  const [bills, setBills] = useState<PaymentStatusBill[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [selectedBill, setSelectedBill] = useState<PaymentStatusBill | null>(null)
  const [billDetails, setBillDetails] = useState<BillWithSlips | null>(null)
  const [detailsLoading, setDetailsLoading] = useState(false)
  const [detailsError, setDetailsError] = useState('')
  const monthButtons = useRef(new Map<string, HTMLButtonElement>())
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

  useEffect(() => {
    monthButtons.current.get(selectedMonth)?.scrollIntoView({ block: 'nearest', inline: 'center' })
  }, [selectedMonth])

  useEffect(() => {
    if (!selectedBill) return
    let active = true
    setDetailsLoading(true)
    setDetailsError('')
    setBillDetails(null)
    void getBillWithSlips(selectedBill.id).then((details) => {
      if (active) setBillDetails(details)
    }).catch((caught) => {
      if (active) setDetailsError(toThaiError(caught))
    }).finally(() => {
      if (active) setDetailsLoading(false)
    })
    return () => { active = false }
  }, [selectedBill])

  const billByHouseMonth = useMemo(() => {
    const result = new Map<string, PaymentStatusBill>()
    for (const bill of bills) result.set(`${bill.house_id}:${bill.period.slice(0, 7)}`, bill)
    return result
  }, [bills])
  const monthlyCounts = useMemo(() => houses.reduce((counts, house) => {
    const bill = billByHouseMonth.get(`${house.id}:${year}-${selectedMonth}`)
    const status = statusOf(bill, today)
    if (status === 'paid' || status === 'waived') counts.paid += 1
    else if (status === 'pending_review') counts.pending += 1
    else if (status === 'overdue') counts.overdue += 1
    else if (status === 'unpaid') counts.unpaid += 1
    return counts
  }, { paid: 0, pending: 0, overdue: 0, unpaid: 0 }), [billByHouseMonth, houses, selectedMonth, today, year])
  const paidCounts = useMemo(() => monthNames.map((_, monthIndex) => {
    const month = `${year}-${String(monthIndex + 1).padStart(2, '0')}`
    return bills.filter((bill) => bill.period.startsWith(month) && (bill.status === 'paid' || bill.status === 'waived')).length
  }), [bills, year])
  const years = Array.from({ length: 5 }, (_, index) => currentYear - 3 + index)
  const monthPeriod = `${year}-${selectedMonth}-01`

  function changeYear(nextYear: number) {
    setYear(nextYear)
    setSelectedMonth(nextYear === currentYear ? currentMonth : '01')
  }

  function selectBill(bill: PaymentStatusBill) {
    setSelectedBill(bill)
  }

  const selectedHouse = selectedBill?.house_no ?? billDetails?.house_no
  const selectedPeriod = selectedBill?.period ?? billDetails?.period

  return (
    <div className="grid min-w-0 gap-5">
      <div>
        <h1 className="font-display text-h1 font-bold text-text-heading">สถานะการจ่ายทั้งหมู่บ้าน</h1>
        <p className="text-body text-text-muted">ตรวจสอบสถานะค่าส่วนกลางรายบ้านและรายเดือน</p>
        <p className="mt-2 flex items-center gap-2 text-body text-text-muted"><Image aria-hidden="true" size={20} />แตะช่องสถานะเพื่อดูรายละเอียดและรูปสลิป</p>
      </div>
      <label className="grid w-full gap-2 text-base leading-6 font-semibold text-text-heading md:max-w-xs">
        ปี พ.ศ.
        <Select onChange={(event) => changeYear(Number(event.target.value))} value={year}>
          {years.map((option) => <option key={option} value={option}>{option + 543}</option>)}
        </Select>
      </label>
      {error && <p aria-live="polite" className="rounded-md bg-tint-danger p-3 text-body text-danger">{error}</p>}
      <Card className="grid min-w-0 gap-4">
        <div className="grid gap-3 md:hidden">
          <div aria-label="เลือกเดือน" className="-mx-4 flex gap-2 overflow-x-auto overscroll-x-contain px-4" role="tablist">
            {monthNames.map((month, index) => {
              const key = String(index + 1).padStart(2, '0')
              const selected = key === selectedMonth
              return (
                <button
                  aria-selected={selected}
                  className={`min-h-touch shrink-0 rounded-full px-4 font-semibold ${selected ? 'bg-primary-fixed font-bold text-on-primary-fixed' : 'bg-surface-low text-text-body'}`}
                  key={key}
                  onClick={() => setSelectedMonth(key)}
                  ref={(element) => {
                    if (element) monthButtons.current.set(key, element)
                    else monthButtons.current.delete(key)
                  }}
                  role="tab"
                  type="button"
                >
                  {month}
                </button>
              )
            })}
          </div>
          <p className="flex flex-wrap gap-x-3 gap-y-1 text-caption text-text-muted">
            <span>จ่ายแล้ว {monthlyCounts.paid}</span>
            <span>รอตรวจ {monthlyCounts.pending}</span>
            <span>ค้าง {monthlyCounts.overdue}</span>
            <span>รอชำระ {monthlyCounts.unpaid}</span>
          </p>
          {loading ? <Spinner /> : (
            <ul className="grid gap-2">
              {houses.map((house) => {
                const bill = billByHouseMonth.get(`${house.id}:${year}-${selectedMonth}`)
                const status = statusOf(bill, today)
                return (
                  <li key={house.id}>
                    {bill ? (
                      <button
                        aria-label={`บ้านเลขที่ ${house.house_no} · ${statusStyle[status].label} · ${formatMonthTH(bill.period)}`}
                        className="flex min-h-14 w-full items-center justify-between gap-3 rounded-lg border border-outline-soft bg-white px-4 text-left"
                        onClick={() => selectBill(bill)}
                        type="button"
                      >
                        <span className="font-display text-h3 font-bold text-text-heading">{house.house_no}</span>
                        <StatusBadge className="shrink-0" dueDate={bill.due_date} status={bill.status} />
                        <ChevronRight aria-hidden="true" className="shrink-0 text-text-muted" size={20} />
                      </button>
                    ) : (
                      <div className="flex min-h-14 items-center justify-between gap-3 rounded-lg border border-outline-soft bg-surface-low px-4">
                        <span className="font-display text-h3 font-bold text-text-heading">{house.house_no}</span>
                        <span className={`inline-flex min-h-8 items-center gap-1.5 rounded-full px-3 py-1 text-base leading-6 font-semibold ${statusStyle.none.className}`}>
                          <CircleDashed aria-hidden="true" size={16} />ไม่มีบิล
                        </span>
                      </div>
                    )}
                  </li>
                )
              })}
              {!houses.length && <li className="py-4 text-body text-text-muted">ยังไม่มีบ้านที่เปิดใช้งาน</li>}
            </ul>
          )}
          <p className="sr-only">สรุปสถานะ {formatMonthTH(monthPeriod)}</p>
        </div>
        <div className="hidden gap-4 md:grid">
          <div className="flex flex-wrap gap-2" aria-label="คำอธิบายสถานะ">
            {(['paid', 'pending_review', 'overdue', 'unpaid', 'waived', 'none'] as CellStatus[]).map((status) => {
              const { label, Icon, className } = statusStyle[status]
              return <span className={`inline-flex min-h-8 items-center gap-1.5 rounded-full px-3 py-1 text-base leading-6 font-semibold ${className}`} key={status}><Icon aria-hidden="true" size={16} />{status === 'none' ? 'ไม่มีบิล' : label}</span>
            })}
          </div>
          {loading ? <Spinner /> : (
            <div className="max-w-full overflow-x-auto overscroll-x-contain">
              <table className="min-w-[1040px] border-collapse text-body">
                <thead>
                  <tr className="bg-surface-low text-text-heading">
                    <th className="sticky left-0 top-0 z-30 min-w-32 border-b border-outline-soft bg-surface-low p-3 text-left font-semibold">บ้านเลขที่</th>
                    {monthNames.map((month) => <th className="sticky top-0 z-20 min-w-20 border-b border-outline-soft bg-surface-low p-3 text-center font-semibold" key={month}>{month}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {houses.map((house, rowIndex) => (
                    <tr className={rowIndex % 2 ? 'bg-surface-low/60' : 'bg-white'} key={house.id}>
                      <th className={`sticky left-0 z-10 min-w-32 border-b border-outline-soft p-3 text-left font-semibold text-text-heading ${rowIndex % 2 ? 'bg-surface-low' : 'bg-white'}`}>{house.house_no}</th>
                      {monthNames.map((_, monthIndex) => {
                        const month = `${year}-${String(monthIndex + 1).padStart(2, '0')}`
                        const bill = billByHouseMonth.get(`${house.id}:${month}`)
                        return (
                          <td className="border-b border-outline-soft p-2 text-center" key={month}>
                            <PaymentCell bill={bill} houseNo={house.house_no} onSelect={selectBill} status={statusOf(bill, today)} />
                          </td>
                        )
                      })}
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-surface-low text-text-heading">
                    <th className="sticky bottom-0 left-0 z-20 border-t border-outline-soft bg-surface-low p-3 text-left font-semibold">จ่ายแล้ว</th>
                    {paidCounts.map((count, monthIndex) => <td className="border-t border-outline-soft p-3 text-center font-semibold tabular-nums" key={monthNames[monthIndex]}>{count}</td>)}
                  </tr>
                </tfoot>
              </table>
              {!houses.length && <p className="p-4 text-body text-text-muted">ยังไม่มีบ้านที่เปิดใช้งาน</p>}
            </div>
          )}
        </div>
      </Card>
      <Modal
        onClose={() => setSelectedBill(null)}
        open={Boolean(selectedBill)}
        title={selectedBill ? `บ้านเลขที่ ${selectedHouse} · ${formatMonthTH(selectedPeriod ?? selectedBill.period)}` : ''}
      >
        {detailsLoading ? <Spinner /> : detailsError ? (
          <p aria-live="polite" className="rounded-md bg-tint-danger p-3 text-body text-danger">{detailsError}</p>
        ) : billDetails ? (
          <div className="grid gap-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <StatusBadge dueDate={billDetails.due_date} status={billDetails.status} />
              <p className="font-display text-h3 font-bold tabular-nums text-text-heading">{formatBaht(billDetails.amount)}</p>
            </div>
            <p className="text-body text-text-muted">ครบกำหนด {formatDateTH(billDetails.due_date)}</p>
            <SlipList houseNo={billDetails.house_no} period={billDetails.period} slips={billDetails.slips} />
            {!billDetails.slips.length && <p className="text-body text-text-muted">ยังไม่มีสลิปสำหรับเดือนนี้</p>}
          </div>
        ) : null}
      </Modal>
    </div>
  )
}

function PaymentCell({ bill, houseNo, onSelect, status }: {
  bill: PaymentStatusBill | undefined
  houseNo: string
  onSelect: (bill: PaymentStatusBill) => void
  status: CellStatus
}) {
  const { label, Icon, className } = statusStyle[status]
  if (!bill) {
    return <span className={`inline-flex min-h-12 items-center justify-center gap-1 rounded-sm px-2 text-caption font-semibold ${className}`} title="ไม่มีบิล">—</span>
  }
  return (
    <button
      aria-label={`บ้านเลขที่ ${houseNo} · ${label} · ${formatMonthTH(bill.period)}`}
      className={`inline-flex min-h-12 min-w-12 items-center justify-center gap-1 rounded-sm px-2 text-caption font-semibold ${className}`}
      onClick={() => onSelect(bill)}
      title={`${label} · ครบกำหนด ${formatDateTH(bill.due_date)}`}
      type="button"
    >
      <Icon aria-hidden="true" size={16} />
      <span>{label}</span>
    </button>
  )
}
