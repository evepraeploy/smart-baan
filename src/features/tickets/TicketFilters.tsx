import { useState } from 'react'
import { Check, ChevronDown, SlidersHorizontal, X } from 'lucide-react'
import { Button } from '../../components/ui/Button'
import { Modal } from '../../components/ui/Modal'
import { toneClass } from '../../components/ui/statusTone'
import type { TicketCategory, TicketStatus } from './api'
import { ticketCategoryLabels, ticketStatusLabels, ticketStatusStyles } from './labels'

const statuses: TicketStatus[] = ['pending', 'in_progress', 'done', 'rejected']
const categories: TicketCategory[] = ['electric', 'plumbing', 'road', 'cleaning', 'security', 'other']
type Counts = Record<TicketStatus, number>
type CategoryCounts = Record<TicketCategory | 'all', number>

export function TicketFilters({ status, category, statusCounts, categoryCounts, onStatusChange, onCategoryChange, showStatusOnWide = false }: {
  status: TicketStatus
  category: TicketCategory | 'all'
  statusCounts: Counts
  categoryCounts: CategoryCounts
  onStatusChange: (status: TicketStatus) => void
  onCategoryChange: (category: TicketCategory | 'all') => void
  showStatusOnWide?: boolean
}) {
  const [open, setOpen] = useState(false)
  const categoryLabel = category === 'all' ? 'ทุกหมวดหมู่' : ticketCategoryLabels[category]
  const statusTilesClass = showStatusOnWide ? '' : '2xl:hidden'
  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        <Button className="w-full justify-between md:w-auto" onClick={() => setOpen(true)} variant="outline">
          <span className="inline-flex items-center gap-2"><SlidersHorizontal aria-hidden="true" size={20} />หมวดหมู่: {categoryLabel}</span>
          <ChevronDown aria-hidden="true" size={20} />
        </Button>
        {category !== 'all' && (
          <button
            aria-label="ล้างตัวกรองหมวดหมู่"
            className="inline-flex min-h-touch items-center gap-2 rounded-full bg-primary-fixed px-3 font-semibold text-on-primary-fixed"
            onClick={() => onCategoryChange('all')}
            type="button"
          >
            {categoryLabel}<X aria-hidden="true" size={18} />
          </button>
        )}
      </div>
      <div aria-label="เลือกสถานะ" className={`grid grid-cols-2 gap-3 md:grid-cols-4 ${statusTilesClass}`}>
        {statuses.map((item) => {
          const { Icon, tone } = ticketStatusStyles[item]
          const selected = item === status
          return (
            <button
              aria-pressed={selected}
              className={`min-h-16 rounded-lg p-3 text-left ${selected ? `${toneClass(tone)} ring-2 ring-primary ring-offset-2 ring-offset-canvas` : 'border border-outline-soft bg-surface text-text-body'}`}
              key={item}
              onClick={() => onStatusChange(item)}
              type="button"
            >
              <span className="flex items-center gap-2 text-caption font-semibold"><Icon aria-hidden="true" size={20} />{ticketStatusLabels[item]}</span>
              <span className="mt-1 block font-display text-h2 font-bold tabular-nums">{statusCounts[item]}</span>
            </button>
          )
        })}
      </div>
      <Modal onClose={() => setOpen(false)} open={open} title="เลือกหมวดหมู่">
        <div aria-label="หมวดหมู่" className="grid gap-2" role="radiogroup">
          {(['all', ...categories] as (TicketCategory | 'all')[]).map((item) => {
            const selected = item === category
            const label = item === 'all' ? 'ทุกหมวดหมู่' : ticketCategoryLabels[item]
            return (
              <button
                aria-checked={selected}
                className={`flex min-h-14 items-center gap-3 rounded-lg px-4 text-left ${selected ? 'bg-primary-fixed font-bold text-on-primary-fixed' : 'bg-surface-low text-text-body'}`}
                key={item}
                onClick={() => {
                  onCategoryChange(item)
                  setOpen(false)
                }}
                role="radio"
                type="button"
              >
                <span className="flex-1">{label}</span>
                <span className="tabular-nums">{categoryCounts[item]}</span>
                {selected && <Check aria-hidden="true" size={20} />}
              </button>
            )
          })}
        </div>
      </Modal>
    </>
  )
}
