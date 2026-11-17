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
