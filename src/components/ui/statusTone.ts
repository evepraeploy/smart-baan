import type { BillTone } from '../../lib/bill-status'

const toneClasses: Record<BillTone, string> = {
  success: 'bg-status-success-bg text-status-success-fg',
  warning: 'bg-status-warning-bg text-status-warning-fg',
  danger: 'bg-status-danger-bg text-status-danger-fg',
  neutral: 'bg-status-neutral-bg text-status-neutral-fg',
}

export function toneClass(tone: BillTone) {
  return toneClasses[tone]
}
