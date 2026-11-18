import { AlertCircle, CheckCircle2, CircleHelp, Clock3, Construction, Droplets, ShieldCheck, Trash2, Wrench, Zap } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import type { BillTone } from '../../lib/bill-status'
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

export const ticketCategoryIcons: Record<TicketCategory, LucideIcon> = {
  electric: Zap,
  plumbing: Droplets,
  road: Construction,
  cleaning: Trash2,
  security: ShieldCheck,
  other: CircleHelp,
}

export const ticketStatusStyles: Record<TicketStatus, {
  Icon: LucideIcon
  tone: BillTone
}> = {
  pending: { Icon: Clock3, tone: 'warning' },
  in_progress: { Icon: Wrench, tone: 'warning' },
  done: { Icon: CheckCircle2, tone: 'success' },
  rejected: { Icon: AlertCircle, tone: 'danger' },
}
