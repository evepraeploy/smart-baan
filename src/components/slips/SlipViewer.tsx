import { useCallback, useEffect, useRef, useState } from 'react'
import { X } from 'lucide-react'
import { SlipStatusBadge } from '../ui/Badge'
import { Spinner } from '../ui/Spinner'
import { formatBaht, formatDateTH, formatMonthTH, formatTimeTH } from '../../lib/format'
import { toThaiError } from '../../lib/errors'
import { getFreshSlipUrl, type SlipRecord } from '../../features/payments/slipsApi'

type Props = {
  slip: SlipRecord | null
  houseNo?: string
  period?: string
  onClose: () => void
}

export function SlipViewer({ slip, houseNo, period, onClose }: Props) {
  const closeButton = useRef<HTMLButtonElement>(null)
  const [url, setUrl] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [zoomed, setZoomed] = useState(false)
  const slipId = slip?.id
  const filePath = slip?.file_path

  const loadImage = useCallback(async () => {
    if (!slipId || !filePath) return
    const path = filePath
    setLoading(true)
    setError('')
    try {
      setUrl(await getFreshSlipUrl(path))
    } catch (caught) {
      setError(toThaiError(caught))
    } finally {
      setLoading(false)
    }
  }, [filePath, slipId])

  useEffect(() => {
    if (!slipId || !filePath) return
    const path = filePath
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const frame = window.requestAnimationFrame(() => closeButton.current?.focus())
    let active = true
    setUrl('')
    setZoomed(false)
    setLoading(true)
    setError('')
    void getFreshSlipUrl(path).then((freshUrl) => {
      if (active) setUrl(freshUrl)
    }).catch((caught: unknown) => {
      if (active) setError(toThaiError(caught))
    }).finally(() => {
      if (active) setLoading(false)
    })
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        event.stopImmediatePropagation()
        onClose()
      }
    }
    window.addEventListener('keydown', onKeyDown, true)
    return () => {
      active = false
      window.cancelAnimationFrame(frame)
      window.removeEventListener('keydown', onKeyDown, true)
      document.body.style.overflow = previousOverflow
      previousFocus?.focus()
    }
  }, [filePath, onClose, slipId])

  if (!slip) return null

  const alt = [
    `สลิปโอนเงิน${houseNo ? `บ้านเลขที่ ${houseNo}` : ''}`,
    period ? `เดือน ${formatMonthTH(period)}` : '',
  ].filter(Boolean).join(' ')

  return (
    <div
      aria-label="รูปสลิปขนาดใหญ่"
      aria-modal="true"
      className="fixed inset-0 z-[80] flex flex-col bg-[rgb(13_28_47/0.95)] text-white"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
      role="dialog"
    >
      <div className="flex h-16 shrink-0 items-center justify-end px-4 pt-[env(safe-area-inset-top)]">
        <button
          aria-label="ปิดรูปสลิป"
          className="grid size-12 place-items-center rounded-full bg-white text-text-heading"
          onClick={onClose}
          ref={closeButton}
          type="button"
        >
          <X aria-hidden="true" size={24} />
        </button>
      </div>
      <div
        className="grid min-h-0 flex-1 place-items-center overflow-auto"
        style={{ touchAction: 'pan-x pan-y pinch-zoom' }}
      >
        {loading ? <Spinner /> : error ? (
          <div className="grid justify-items-center gap-3 p-5 text-center">
            <p className="text-body">{error}</p>
            <button className="min-h-touch rounded-md bg-white px-5 font-semibold text-text-heading" onClick={() => void loadImage()} type="button">ลองอีกครั้ง</button>
          </div>
        ) : url ? (
          <button
            aria-label={zoomed ? 'ย่อรูปสลิป' : 'ขยายรูปสลิป'}
            className="grid h-full w-full min-h-full min-w-full place-items-center overflow-auto"
            onClick={() => setZoomed((current) => !current)}
            style={{ touchAction: 'pan-x pan-y pinch-zoom' }}
            type="button"
          >
            <span className={`grid place-items-center ${zoomed ? 'h-[200%] w-[200%]' : 'h-full w-full'}`}>
              <img alt={alt} className="max-h-full max-w-full object-contain" src={url} />
            </span>
          </button>
        ) : null}
      </div>
      <div className="max-h-[32dvh] shrink-0 overflow-y-auto border-t border-white/20 bg-inverse-surface px-4 pt-3 pb-[calc(16px+env(safe-area-inset-bottom))]">
        <div className="mx-auto grid max-w-3xl gap-2">
          <div className="flex flex-wrap items-center gap-3">
            <SlipStatusBadge status={slip.status} />
            <p className="font-display text-h3 font-bold tabular-nums">{formatBaht(slip.amount)}</p>
          </div>
          <div className="grid gap-x-4 gap-y-1 text-caption text-white/80 sm:grid-cols-2">
            <p>โอนเมื่อ {formatDateTH(slip.transferred_at)} {formatTimeTH(slip.transferred_at)} น.</p>
            <p>ส่งเมื่อ {formatDateTH(slip.created_at)} {formatTimeTH(slip.created_at)} น.</p>
          </div>
          {slip.status === 'rejected' && slip.reject_reason && (
            <p className="rounded-md bg-tint-danger p-3 text-body text-danger"><strong>เหตุผลที่ไม่ผ่าน:</strong> {slip.reject_reason}</p>
          )}
        </div>
      </div>
    </div>
  )
}
