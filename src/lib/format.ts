const dateOptions: Intl.DateTimeFormatOptions = {
  timeZone: 'Asia/Bangkok',
  calendar: 'buddhist',
}

export function formatDateTH(value: string | Date): string {
  return new Intl.DateTimeFormat('th-TH', {
    ...dateOptions,
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(new Date(value))
}

export function formatDateTimeTH(value: string | Date): string {
  const date = new Date(value)
  const formattedDate = new Intl.DateTimeFormat('th-TH', {
    ...dateOptions,
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(date)
  const formattedTime = new Intl.DateTimeFormat('th-TH', {
    timeZone: 'Asia/Bangkok',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).format(date)
  return `${formattedDate} ${formattedTime} น.`
}

export function formatDateTimeInputTH(value = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Bangkok',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(value)
  const part = (name: string) => parts.find((item) => item.type === name)?.value ?? ''
  return `${part('year')}-${part('month')}-${part('day')}T${part('hour')}:${part('minute')}`
}

export function parseDateTimeInputTH(value: string): Date {
  return new Date(`${value}:00+07:00`)
}

export function formatMonthTH(period: string | Date): string {
  return new Intl.DateTimeFormat('th-TH', {
    ...dateOptions,
    month: 'short',
    year: 'numeric',
  }).format(new Date(period))
}

export function formatBaht(amount: number | string): string {
  return `${new Intl.NumberFormat('th-TH', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number(amount))} บาท`
}
