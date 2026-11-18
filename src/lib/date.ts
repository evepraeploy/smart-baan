function bangkokParts(options: Intl.DateTimeFormatOptions): Record<string, string> {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Bangkok',
    ...options,
  }).formatToParts(new Date())
  return Object.fromEntries(parts.map(({ type, value }) => [type, value]))
}

export function currentBangkokYear(): number {
  return Number(bangkokParts({ year: 'numeric' }).year)
}

export function currentBangkokMonth(): string {
  const parts = bangkokParts({ year: 'numeric', month: '2-digit' })
  return `${parts.year}-${parts.month}`
}

export function currentBangkokDate(): string {
  const parts = bangkokParts({ year: 'numeric', month: '2-digit', day: '2-digit' })
  return `${parts.year}-${parts.month}-${parts.day}`
}

export function getBangkokMonthUtcBounds(month: string): { start: string; end: string } {
  const match = /^(\d{4})-(\d{2})$/.exec(month)
  if (!match) throw new RangeError('Month must use YYYY-MM format')
  const year = Number(match[1])
  const monthNumber = Number(match[2])
  if (monthNumber < 1 || monthNumber > 12) throw new RangeError('Month must be between 01 and 12')
  const bangkokOffset = 7 * 60 * 60 * 1000
  return {
    start: new Date(Date.UTC(year, monthNumber - 1, 1) - bangkokOffset).toISOString(),
    end: new Date(Date.UTC(year, monthNumber, 1) - bangkokOffset).toISOString(),
  }
}
