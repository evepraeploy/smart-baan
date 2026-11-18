import { useCallback, useState } from 'react'
import { ImageOff } from 'lucide-react'
import { SlipStatusBadge } from '../ui/Badge'
import { formatBaht, formatDateTH, formatTimeTH } from '../../lib/format'
import { SlipViewer } from './SlipViewer'
import type { SlipRecord } from '../../features/payments/slipsApi'

export function SlipList({ slips, houseNo, period }: { slips: SlipRecord[]; houseNo?: string; period?: string }) {
  const [selected, setSelected] = useState<SlipRecord | null>(null)
  const closeViewer = useCallback(() => setSelected(null), [])
  if (!slips.length) return null
  const newestFirst = [...slips].sort((a, b) => b.created_at.localeCompare(a.created_at))

  return (
    <>
      <section className="grid gap-3" aria-label={`สลิปที่ส่ง ${slips.length} รายการ`}>
        <h3 className="text-base leading-6 font-semibold text-text-muted">สลิปที่ส่ง ({slips.length})</h3>
        <ul className="grid">
          {newestFirst.map((slip) => {
            const sentLabel = `${formatDateTH(slip.created_at)} ${formatTimeTH(slip.created_at)} น.`
            return (
              <li className="border-t border-outline-soft pt-3 first:border-0 first:pt-0" key={slip.id}>
                <div className="flex min-h-[72px] items-center gap-3">
                  <button
                    aria-label={`ดูรูปสลิป ส่งเมื่อ ${sentLabel}`}
                    className="grid size-[72px] shrink-0 place-items-center overflow-hidden rounded-md bg-surface-mid"
                    onClick={() => setSelected(slip)}
                    type="button"
                  >
                    {slip.thumb_url
                      ? <img alt="" className="size-full object-cover" src={slip.thumb_url} />
                      : <ImageOff aria-hidden="true" className="text-text-muted" size={24} />}
                  </button>
                  <div className="grid min-w-0 flex-1 gap-1">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <SlipStatusBadge status={slip.status} />
                      <p className="font-display text-h3 font-bold tabular-nums text-text-heading">{formatBaht(slip.amount)}</p>
                    </div>
                    <p className="text-body text-text-muted">โอน {formatDateTH(slip.transferred_at)} {formatTimeTH(slip.transferred_at)} น.</p>
                    {slip.status === 'rejected' && slip.reject_reason && (
                      <p className="rounded-md bg-tint-danger p-3 text-body text-danger">{slip.reject_reason}</p>
                    )}
                  </div>
                </div>
              </li>
            )
          })}
        </ul>
      </section>
      <SlipViewer houseNo={houseNo} onClose={closeViewer} period={period} slip={selected} />
    </>
  )
}
