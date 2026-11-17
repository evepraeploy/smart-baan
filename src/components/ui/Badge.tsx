import { Calendar, CircleCheck, Clock, TriangleAlert } from 'lucide-react'
import type { BillStatusValue } from '../../lib/bill-status'
import { getBillDisplayStatus } from '../../lib/bill-status'

type Props = { status: BillStatusValue; dueDate?: string; className?: string }

export function StatusBadge({ status, dueDate = '9999-12-31', className = '' }: Props) {
  const display = getBillDisplayStatus(status, dueDate)
  const Icon = display.icon
  return (
    <span
      className={`inline-flex min-h-10 items-center gap-2 rounded-full border px-3 text-caption font-semibold ${
        display.tone === 'success'
          ? 'border-status-success-border bg-status-success-bg text-status-success-fg'
          : display.tone === 'warning'
            ? 'border-status-warning-border bg-status-warning-bg text-status-warning-fg'
            : display.tone === 'danger'
              ? 'border-status-danger-border bg-status-danger-bg text-status-danger-fg'
              : 'border-status-neutral-border bg-status-neutral-bg text-status-neutral-fg'
      } ${className}`}
    >
      <Icon aria-hidden="true" size={18} />
      {display.label}
    </span>
  )
}

export function SlipStatusBadge({ status }: { status: 'pending' | 'approved' | 'rejected' }) {
  const info = {
    pending: { label: 'รอตรวจสอบ', Icon: Clock, style: 'border-status-warning-border bg-status-warning-bg text-status-warning-fg' },
    approved: { label: 'อนุมัติแล้ว', Icon: CircleCheck, style: 'border-status-success-border bg-status-success-bg text-status-success-fg' },
    rejected: { label: 'ไม่ผ่าน กรุณาส่งใหม่', Icon: TriangleAlert, style: 'border-status-danger-border bg-status-danger-bg text-status-danger-fg' },
  }[status]
  const { Icon } = info
  return (
    <span className={`inline-flex min-h-10 items-center gap-2 rounded-full border px-3 text-caption font-semibold ${info.style}`}>
      <Icon aria-hidden="true" size={18} />
      {info.label}
    </span>
  )
}

export function NeutralBadge({ children }: { children: string }) {
  return (
    <span className="inline-flex min-h-10 items-center gap-2 rounded-full border border-status-neutral-border bg-status-neutral-bg px-3 text-caption font-semibold text-status-neutral-fg">
      <Calendar aria-hidden="true" size={18} />
      {children}
    </span>
  )
}
