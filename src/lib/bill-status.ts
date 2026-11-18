import { Calendar, CircleCheck, Clock, TriangleAlert, type LucideIcon } from 'lucide-react'

export type BillStatusValue = 'unpaid' | 'pending_review' | 'paid' | 'waived'
export type BillTone = 'success' | 'warning' | 'danger' | 'neutral'

export function getBillDisplayStatus(
  status: BillStatusValue,
  dueDate: string,
  now = new Date(),
): { label: string; tone: BillTone; icon: LucideIcon } {
  if (status === 'paid') return { label: 'จ่ายแล้ว', tone: 'success', icon: CircleCheck }
  if (status === 'pending_review') return { label: 'รอตรวจสอบ', tone: 'warning', icon: Clock }
  if (status === 'waived') return { label: 'ยกเว้น', tone: 'neutral', icon: Calendar }
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Bangkok',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now)
  const today = `${parts.find((part) => part.type === 'year')?.value}-${parts.find((part) => part.type === 'month')?.value}-${parts.find((part) => part.type === 'day')?.value}`
  return today > dueDate
    ? { label: 'ค้างชำระ', tone: 'danger', icon: TriangleAlert }
    : { label: 'รอชำระ', tone: 'warning', icon: Clock }
}

export function getDueCountdown(dueDate: string, now = new Date()): { days: number; label: string; overdue: boolean } {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Bangkok',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now)
  const today = `${parts.find((part) => part.type === 'year')?.value}-${parts.find((part) => part.type === 'month')?.value}-${parts.find((part) => part.type === 'day')?.value}`
  const days = Math.round((Date.parse(`${dueDate}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / 86_400_000)
  if (days < 0) return { days: Math.abs(days), label: `เลยกำหนด ${Math.abs(days)} วัน`, overdue: true }
  if (days === 0) return { days: 0, label: 'ครบกำหนดวันนี้', overdue: false }
  return { days, label: `อีก ${days} วัน`, overdue: false }
}
