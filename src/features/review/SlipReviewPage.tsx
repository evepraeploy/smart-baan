import { useCallback, useEffect, useState } from 'react'
import { AlertTriangle, Image as ImageIcon, ZoomIn, X } from 'lucide-react'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { EmptyState } from '../../components/ui/EmptyState'
import { Field, Textarea } from '../../components/ui/Field'
import { Modal } from '../../components/ui/Modal'
import { SlipStatusBadge } from '../../components/ui/Badge'
import { Spinner } from '../../components/ui/Spinner'
import { useToast } from '../../components/ui/Toast'
import { formatBaht, formatDateTimeTH, formatMonthTH } from '../../lib/format'
import { messages } from '../../lib/messages.th'
import { toThaiError } from '../../lib/errors'
import { approveSlip, listPendingSlips, rejectSlip, type PendingSlip } from './api'

export function SlipReviewPage() {
  const { showToast } = useToast()
  const [items, setItems] = useState<PendingSlip[]>([])
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState('')
  const [error, setError] = useState('')
  const [zoomImage, setZoomImage] = useState('')
  const [zoomed, setZoomed] = useState(false)
  const [selected, setSelected] = useState<PendingSlip | null>(null)
  const [modal, setModal] = useState<'approve' | 'reject' | null>(null)
  const [reason, setReason] = useState('')
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

  if (loading && !items.length) return <Spinner />
  return (
    <div className="grid gap-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div><h1 className="text-h1 font-bold text-text-heading">ตรวจสลิป</h1><p className="text-body text-text-muted">รายการที่รอตรวจสอบ {items.length} รายการ</p></div>
        <Button onClick={() => void refresh()} variant="secondary">รีเฟรชรายการ</Button>
      </div>
      {error && <p className="rounded-md bg-red-50 p-3 text-body text-red-700">{error}</p>}
      {!items.length ? (
        <Card><EmptyState description="เมื่อมีการส่งสลิปใหม่ รายการจะแสดงที่นี่" icon={ImageIcon} title="ไม่มีสลิปที่รอตรวจสอบ" /></Card>
      ) : (
        <div className="grid gap-4">
          {items.map((item) => (
            <Card className="grid gap-4 lg:grid-cols-[220px_1fr]" key={item.id}>
                <button aria-label={`ขยายรูปสลิปบ้านเลขที่ ${item.house_no}`} className="group relative min-h-48 overflow-hidden rounded-md bg-subtle" onClick={() => { if (item.signed_url) { setZoomed(false); setZoomImage(item.signed_url) } }} type="button">
                {item.signed_url ? <img alt={`สลิปบ้านเลขที่ ${item.house_no}`} className="h-52 w-full object-cover transition-transform group-hover:scale-[1.02]" src={item.signed_url} /> : <span className="grid h-52 place-items-center text-text-muted"><ImageIcon size={40} /></span>}
                <span className="absolute bottom-2 right-2 rounded-full bg-white p-2 text-primary-700 shadow-card"><ZoomIn size={18} /></span>
              </button>
              <div className="grid content-start gap-3">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div><h2 className="text-h2 font-bold text-text-heading">บ้านเลขที่ {item.house_no}</h2><p className="text-body text-text-muted">โอนเมื่อ {formatDateTimeTH(item.transferred_at)}</p></div>
                  <SlipStatusBadge status="pending" />
                </div>
                <p className="text-display font-bold text-text-heading">{formatBaht(item.amount)}</p>
                <div className="flex flex-wrap gap-2">
                  {item.periods?.map((period) => <span className="rounded-full bg-subtle px-3 py-1 text-caption text-text-body" key={period}>{formatMonthTH(period)}</span>)}
                </div>
                {Number(item.duplicate_count) > 0 && <p className="flex items-center gap-2 rounded-md bg-amber-50 p-3 text-body font-semibold text-amber-800"><AlertTriangle size={20} />พบสลิปยอดและเวลาใกล้เคียงกัน โปรดตรวจสอบ</p>}
                <div className="grid gap-3 sm:grid-cols-2">
                  <Button onClick={() => openAction(item, 'reject')} variant="danger-outline">ไม่อนุมัติ</Button>
                  <Button onClick={() => openAction(item, 'approve')}>อนุมัติ</Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
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
      {zoomImage && (
        <div aria-label="รูปสลิปขนาดใหญ่" aria-modal="true" className="fixed inset-0 z-[60] grid place-items-center overflow-auto bg-slate-950/95 p-4" role="dialog">
          <button aria-label="ปิดรูปสลิป" className="fixed right-4 top-4 z-10 grid min-h-touch min-w-touch place-items-center rounded-full bg-white text-text-heading" onClick={() => { setZoomImage(''); setZoomed(false) }} type="button"><X size={24} /></button>
          <button aria-label={zoomed ? 'ย่อรูปสลิป' : 'ขยายรูปสลิป'} className="grid min-h-full min-w-full place-items-center overflow-auto" onClick={() => setZoomed((current) => !current)} type="button">
            <img alt="รูปสลิปขนาดใหญ่ แตะเพื่อขยายหรือย่อ" className={zoomed ? 'max-h-none max-w-none scale-150 object-contain' : 'max-h-[92dvh] max-w-[94vw] object-contain'} src={zoomImage} />
          </button>
        </div>
      )}
    </div>
  )
}
