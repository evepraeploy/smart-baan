import { Calendar, CircleCheck, Clock, TriangleAlert } from 'lucide-react'
import type { BillStatusValue } from '../../lib/bill-status'
import { getBillDisplayStatus } from '../../lib/bill-status'
import { toneClass } from './statusTone'

type Props = { status: BillStatusValue; dueDate?: string; className?: string }

export function StatusBadge({ status, dueDate = '9999-12-31', className = '' }: Props) {
  const display = getBillDisplayStatus(status, dueDate)
  const Icon = display.icon
  return (
    <span
      className={`inline-flex min-h-8 items-center gap-1.5 rounded-full px-3 py-1 text-base leading-6 font-semibold ${toneClass(display.tone)} ${className}`}
    >
      <Icon aria-hidden="true" size={16} />
      {display.label}
    </span>
  )
}

export function SlipStatusBadge({ status }: { status: 'pending' | 'approved' | 'rejected' }) {
  const info = {
    pending: { label: 'รอตรวจสอบ', Icon: Clock, tone: 'warning' as const },
    approved: { label: 'อนุมัติแล้ว', Icon: CircleCheck, tone: 'success' as const },
    rejected: { label: 'ไม่ผ่าน กรุณาส่งใหม่', Icon: TriangleAlert, tone: 'danger' as const },
  }[status]
  const { Icon } = info
  return (
    <span className={`inline-flex min-h-8 items-center gap-1.5 rounded-full px-3 py-1 text-base leading-6 font-semibold ${toneClass(info.tone)}`}>
      <Icon aria-hidden="true" size={16} />
      {info.label}
    </span>
  )
}

export function NeutralBadge({ children }: { children: string }) {
  return (
    <span className={`inline-flex min-h-8 items-center gap-1.5 rounded-full px-3 py-1 text-base leading-6 font-semibold ${toneClass('neutral')}`}>
      <Calendar aria-hidden="true" size={16} />
      {children}
    </span>
  )
}
