import { useCallback, useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router'
import { AlertTriangle, CalendarDays, Check, Image as ImageIcon, ImageOff, ZoomIn } from 'lucide-react'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { EmptyState } from '../../components/ui/EmptyState'
import { SlipViewer } from '../../components/slips/SlipViewer'
import { Field, Input, Textarea } from '../../components/ui/Field'
import { Modal } from '../../components/ui/Modal'
import { SlipStatusBadge } from '../../components/ui/Badge'
import { Spinner } from '../../components/ui/Spinner'
import { useToast } from '../../components/ui/Toast'
import { currentBangkokMonth } from '../../lib/date'
import { formatBaht, formatDateTimeTH, formatMonthTH } from '../../lib/format'
import { messages } from '../../lib/messages.th'
import { toThaiError } from '../../lib/errors'
import { approveSlip, listPendingSlips, listReviewedSlips, rejectSlip, type PendingSlip, type ReviewedSlip } from './api'
import type { SlipRecord } from '../payments/slipsApi'

type ReviewTab = 'review' | 'reviewed'
type ReviewStatusFilter = 'all' | 'approved' | 'rejected'
type ViewerSlip = SlipRecord & { house_no?: string; periods?: string[] }

export function SlipReviewPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const tab: ReviewTab = searchParams.get('tab') === 'reviewed' ? 'reviewed' : 'review'
  const { showToast } = useToast()
  const [items, setItems] = useState<PendingSlip[]>([])
  const [reviewedItems, setReviewedItems] = useState<ReviewedSlip[]>([])
  const [loading, setLoading] = useState(true)
  const [reviewedLoading, setReviewedLoading] = useState(false)
  const [busyId, setBusyId] = useState('')
  const [error, setError] = useState('')
  const [reviewedError, setReviewedError] = useState('')
  const [viewingSlip, setViewingSlip] = useState<ViewerSlip | null>(null)
  const [selected, setSelected] = useState<PendingSlip | null>(null)
  const [modal, setModal] = useState<'approve' | 'reject' | null>(null)
  const [reason, setReason] = useState('')
  const [month, setMonth] = useState(currentBangkokMonth)
  const [monthOpen, setMonthOpen] = useState(false)
  const [statusFilter, setStatusFilter] = useState<ReviewStatusFilter>('all')
  const [houseSearch, setHouseSearch] = useState('')
  const [historyRefreshKey, setHistoryRefreshKey] = useState(0)

  const refresh = useCallback(async () => {
    setLoading(true)
    try {
      setItems(await listPendingSlips())
      setError('')
    } catch (caught) {
      setError(toThaiError(caught))
    } finally {
      setLoading(false)
    }
  }, [])
  useEffect(() => { void refresh() }, [refresh])

  useEffect(() => {
    if (tab !== 'reviewed') return
    let active = true
    setReviewedLoading(true)
    setReviewedError('')
    void listReviewedSlips(month).then((slips) => {
      if (active) setReviewedItems(slips)
    }).catch((caught) => {
      if (active) setReviewedError(toThaiError(caught))
    }).finally(() => {
      if (active) setReviewedLoading(false)
    })
    return () => { active = false }
  }, [historyRefreshKey, month, tab])

  const closeViewer = useCallback(() => setViewingSlip(null), [])
  const filteredReviewed = useMemo(() => reviewedItems.filter((slip) => (
    (statusFilter === 'all' || slip.status === statusFilter)
    && slip.house_no.toLowerCase().includes(houseSearch.trim().toLowerCase())
  )), [houseSearch, reviewedItems, statusFilter])
  const monthOptions = useMemo(() => {
    const [year, monthNumber] = currentBangkokMonth().split('-').map(Number)
    return Array.from({ length: 12 }, (_, index) => {
      const date = new Date(Date.UTC(year, monthNumber - 1 - index, 1))
      return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`
    })
  }, [])

  function changeTab(nextTab: ReviewTab) {
    const next = new URLSearchParams(searchParams)
    if (nextTab === 'reviewed') next.set('tab', 'reviewed')
    else next.delete('tab')
    setSearchParams(next, { replace: true })
  }

  function refreshCurrentTab() {
    if (tab === 'reviewed') setHistoryRefreshKey((current) => current + 1)
    else void refresh()
  }

  function openAction(item: PendingSlip, action: 'approve' | 'reject') {
    setSelected(item)
    setModal(action)
    setReason('')
  }

  async function confirmAction() {
    if (!selected || !modal) return
    if (modal === 'reject' && reason.trim().length < 3) {
      setError(messages.reasonRequired)
      return
    }
    setBusyId(selected.id)
    setError('')
    try {
      if (modal === 'approve') await approveSlip(selected.id)
      else await rejectSlip(selected.id, reason.trim())
      setModal(null)
      setSelected(null)
      showToast(messages.reviewComplete)
      await refresh()
    } catch (caught) {
      const message = toThaiError(caught)
      setError(message)
      if (message === messages.slipAlreadyReviewed) {
        setModal(null)
        await refresh()
      }
    } finally {
      setBusyId('')
    }
  }

  return (
    <div className="grid gap-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-h1 font-bold text-text-heading">ตรวจสลิป</h1>
          <p className="text-body text-text-muted">{tab === 'reviewed' ? `รายการที่ตรวจแล้ว ${reviewedItems.length} รายการ` : `รายการที่รอตรวจสอบ ${items.length} รายการ`}</p>
        </div>
        <Button onClick={refreshCurrentTab} variant="secondary">รีเฟรชรายการ</Button>
      </div>
      <div aria-label="สถานะสลิป" className="grid grid-cols-2 rounded-lg bg-surface-low p-1" role="tablist">
        <button
          aria-selected={tab === 'review'}
          className={`min-h-touch rounded-md px-3 font-semibold ${tab === 'review' ? 'bg-surface text-primary shadow-card' : 'text-text-muted'}`}
          onClick={() => changeTab('review')}
          role="tab"
          type="button"
        >
          รอตรวจ ({items.length})
        </button>
        <button
          aria-selected={tab === 'reviewed'}
          className={`min-h-touch rounded-md px-3 font-semibold ${tab === 'reviewed' ? 'bg-surface text-primary shadow-card' : 'text-text-muted'}`}
          onClick={() => changeTab('reviewed')}
          role="tab"
          type="button"
        >
          ตรวจแล้ว
        </button>
      </div>
      {tab === 'review' ? (
        <>
          {error && <p className="rounded-md bg-tint-danger p-3 text-body text-danger">{error}</p>}
          {loading ? <Spinner /> : !items.length ? (
            <Card><EmptyState description="เมื่อมีการส่งสลิปใหม่ รายการจะแสดงที่นี่" icon={ImageIcon} title="ไม่มีสลิปที่รอตรวจสอบ" /></Card>
          ) : (
            <div className="grid gap-4">
              {items.map((item) => (
                <Card className="grid gap-4 lg:grid-cols-[220px_1fr]" key={item.id}>
                  <button aria-label={`ขยายรูปสลิปบ้านเลขที่ ${item.house_no}`} className="group relative min-h-48 overflow-hidden rounded-md bg-surface-low" onClick={() => { if (item.file_path) setViewingSlip({ ...item, reject_reason: null, thumb_url: item.signed_url }) }} type="button">
                    {item.signed_url ? <img alt={`สลิปบ้านเลขที่ ${item.house_no}`} className="h-52 w-full object-cover transition-transform group-hover:scale-[1.02]" src={item.signed_url} /> : <span className="grid h-52 place-items-center text-text-muted"><ImageIcon size={40} /></span>}
                    <span className="absolute bottom-2 right-2 rounded-full bg-white p-2 text-primary shadow-card"><ZoomIn size={18} /></span>
                  </button>
                  <div className="grid content-start gap-3">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div><h2 className="font-display text-h2 font-bold text-text-heading">บ้านเลขที่ {item.house_no}</h2><p className="text-body text-text-muted">โอนเมื่อ {formatDateTimeTH(item.transferred_at)}</p></div>
                      <SlipStatusBadge status="pending" />
                    </div>
                    <p className="font-display text-display font-bold text-text-heading">{formatBaht(item.amount)}</p>
                    <div className="flex flex-wrap gap-2">
                      {item.periods?.map((period) => <span className="rounded-full bg-surface-low px-3 py-1 text-caption text-text-body" key={period}>{formatMonthTH(period)}</span>)}
                    </div>
                    {Number(item.duplicate_count) > 0 && <p className="flex items-center gap-2 rounded-md bg-tint-warning p-3 text-body font-semibold text-secondary"><AlertTriangle size={20} />พบสลิปยอดและเวลาใกล้เคียงกัน โปรดตรวจสอบ</p>}
                    <div className="grid gap-3 sm:grid-cols-2">
                      <Button onClick={() => openAction(item, 'reject')} variant="danger-outline">ไม่อนุมัติ</Button>
                      <Button onClick={() => openAction(item, 'approve')}>อนุมัติ</Button>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </>
      ) : (
        <>
          {reviewedError && <p aria-live="polite" className="rounded-md bg-tint-danger p-3 text-body text-danger">{reviewedError}</p>}
          <div className="grid gap-3 lg:grid-cols-[auto_1fr_20rem] lg:items-end">
            <Button className="w-full lg:w-auto" onClick={() => setMonthOpen(true)} variant="outline">
              <CalendarDays aria-hidden="true" size={20} />เดือน: {formatMonthTH(`${month}-01`)}
            </Button>
            <div aria-label="กรองตามผลการตรวจ" className="grid grid-cols-3 rounded-lg bg-surface-low p-1" role="tablist">
              {([
                ['all', 'ทั้งหมด'],
                ['approved', 'อนุมัติแล้ว'],
                ['rejected', 'ไม่ผ่าน'],
              ] as [ReviewStatusFilter, string][]).map(([value, label]) => (
                <button
                  aria-selected={statusFilter === value}
                  className={`min-h-touch rounded-md px-2 text-caption font-semibold ${statusFilter === value ? 'bg-surface text-primary shadow-card' : 'text-text-muted'}`}
                  key={value}
                  onClick={() => setStatusFilter(value)}
                  role="tab"
                  type="button"
                >
                  {label}
                </button>
              ))}
            </div>
            <Field label="ค้นหาบ้านเลขที่">
              <Input inputMode="text" onChange={(event) => setHouseSearch(event.target.value)} placeholder="ค้นหาบ้านเลขที่" type="search" value={houseSearch} />
            </Field>
          </div>
          {reviewedLoading ? <Spinner /> : !filteredReviewed.length ? (
            <Card><EmptyState description="ปรับเดือน สถานะ หรือบ้านเลขที่เพื่อค้นหารายการ" icon={ImageIcon} title="ไม่มีสลิปที่ตรวจแล้วในเดือนนี้" /></Card>
          ) : (
            <div className="grid gap-4">
              {filteredReviewed.map((slip) => (
                <ReviewedSlipCard key={slip.id} onView={() => setViewingSlip(slip)} slip={slip} />
              ))}
            </div>
          )}
        </>
      )}
      <Modal
        onClose={() => setMonthOpen(false)}
        open={monthOpen}
        title="เลือกเดือน"
      >
        <div aria-label="เดือนที่ส่งสลิป" className="grid gap-2" role="radiogroup">
          {monthOptions.map((option) => {
            const selectedMonth = option === month
            return (
              <button
                aria-checked={selectedMonth}
                className={`flex min-h-14 items-center gap-3 rounded-lg px-4 text-left ${selectedMonth ? 'bg-primary-fixed font-bold text-on-primary-fixed' : 'bg-surface-low text-text-body'}`}
                key={option}
                onClick={() => {
                  setMonth(option)
                  setMonthOpen(false)
                }}
                role="radio"
                type="button"
              >
                <span className="flex-1">{formatMonthTH(`${option}-01`)}</span>
                {selectedMonth && <Check aria-hidden="true" size={20} />}
              </button>
            )
          })}
        </div>
      </Modal>
      <Modal
        busy={Boolean(busyId)}
        footer={<>
          <Button disabled={Boolean(busyId)} onClick={() => setModal(null)} variant="secondary">ยกเลิก</Button>
          <Button busy={Boolean(busyId)} onClick={() => void confirmAction()} variant={modal === 'reject' ? 'danger' : 'primary'}>{modal === 'reject' ? 'ยืนยันไม่อนุมัติ' : 'ยืนยันอนุมัติ'}</Button>
        </>}
        onClose={() => setModal(null)}
        open={Boolean(modal)}
        title={modal === 'reject' ? 'ไม่อนุมัติสลิป' : 'ยืนยันการอนุมัติ'}
      >
        {modal === 'reject'
          ? <Field label="ระบุเหตุผลที่ไม่อนุมัติ"><Textarea onChange={(event) => setReason(event.target.value)} placeholder="ลูกบ้านจะเห็นเหตุผลนี้" value={reason} /></Field>
          : <p className="text-body-lg text-text-body">ยืนยันการอนุมัติสลิปบ้านเลขที่ {selected?.house_no} ยอด {selected ? formatBaht(selected.amount) : ''} ใช่หรือไม่</p>}
      </Modal>
      <SlipViewer houseNo={viewingSlip?.house_no} onClose={closeViewer} period={viewingSlip?.periods?.[0]} slip={viewingSlip} />
    </div>
  )
}

function ReviewedSlipCard({ slip, onView }: { slip: ReviewedSlip; onView: () => void }) {
  return (
    <Card className="grid min-w-0 gap-4 sm:grid-cols-[72px_1fr]">
      <button
        aria-label={`ดูรูปสลิปบ้านเลขที่ ${slip.house_no}`}
        className="grid size-[72px] place-items-center overflow-hidden rounded-md bg-surface-mid"
        onClick={onView}
        type="button"
      >
        {slip.thumb_url ? <img alt="" className="size-full object-cover" src={slip.thumb_url} /> : <ImageOff aria-hidden="true" className="text-text-muted" size={24} />}
      </button>
      <div className="grid min-w-0 content-start gap-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-display text-h3 font-bold text-text-heading">บ้านเลขที่ {slip.house_no}</h2>
          <SlipStatusBadge status={slip.status} />
        </div>
        <p className="font-display text-h3 font-bold tabular-nums text-text-heading">{formatBaht(slip.amount)}</p>
        <div className="flex flex-wrap gap-2">
          {slip.periods.map((period) => <span className="rounded-full bg-surface-low px-3 py-1 text-caption text-text-body" key={period}>{formatMonthTH(period)}</span>)}
        </div>
        <p className="text-body text-text-muted">ส่งเมื่อ {formatDateTimeTH(slip.created_at)}</p>
        {slip.status === 'rejected' && slip.reject_reason && (
          <p className="rounded-md bg-tint-danger p-3 text-body text-danger">{slip.reject_reason}</p>
        )}
      </div>
    </Card>
  )
}
