export type PmStatus = 'overdue' | 'soon' | 'ok' | 'none'

export function getPmStatus(nextDue: string | null, today: string): PmStatus {
  if (!nextDue) return 'none'
  if (nextDue < today) return 'overdue'
  const dueTime = Date.parse(`${nextDue}T00:00:00Z`)
  const todayTime = Date.parse(`${today}T00:00:00Z`)
  if (dueTime - todayTime <= 14 * 24 * 60 * 60 * 1000) return 'soon'
  return 'ok'
}
