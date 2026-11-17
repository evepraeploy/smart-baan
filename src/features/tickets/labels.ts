import { AlertCircle, CheckCircle2, Clock3, Wrench } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import type { TicketCategory, TicketStatus } from './api'

export const ticketStatusLabels: Record<TicketStatus, string> = {
  pending: 'รอรับเรื่อง',
  in_progress: 'กำลังดำเนินการ',
  done: 'เสร็จแล้ว',
  rejected: 'ไม่รับเรื่อง',
}

export const ticketCategoryLabels: Record<TicketCategory, string> = {
  electric: 'ไฟฟ้า',
  plumbing: 'ประปา',
  road: 'ถนน/ทางเท้า',
  cleaning: 'ความสะอาด',
  security: 'ความปลอดภัย',
  other: 'อื่น ๆ',
}

export const ticketStatusStyles: Record<TicketStatus, {
  Icon: LucideIcon
  className: string
}> = {
  pending: { Icon: Clock3, className: 'bg-status-warning-bg text-status-warning-fg' },
  in_progress: { Icon: Wrench, className: 'bg-status-warning-bg text-status-warning-fg' },
  done: { Icon: CheckCircle2, className: 'bg-status-success-bg text-status-success-fg' },
  rejected: { Icon: AlertCircle, className: 'bg-status-danger-bg text-status-danger-fg' },
}
