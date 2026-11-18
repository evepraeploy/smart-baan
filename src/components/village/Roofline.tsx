import type { CSSProperties } from 'react'

export type HousePaymentState = 'paid' | 'pending' | 'unpaid'
export type RooflineHouse = { key: string; state: HousePaymentState; mine?: boolean }

type HouseGlyphProps = {
  state: HousePaymentState
  mine?: boolean
  brand?: boolean
  size?: 'S' | 'M'
  animationDelay?: number
}

export function HouseGlyph({ state, mine = false, brand = false, size = 'M', animationDelay }: HouseGlyphProps) {
  const stateClass = brand
    ? 'fill-white stroke-white'
    : state === 'paid'
      ? 'fill-primary-container stroke-primary-container'
      : state === 'pending'
        ? 'fill-secondary-fixed stroke-secondary'
        : 'fill-transparent stroke-outline'
  const animationStyle = state === 'paid' && animationDelay !== undefined && !brand
    ? { animation: 'roofline-paid 200ms ease-out both', animationDelay: `${animationDelay}ms` } satisfies CSSProperties
    : undefined

  return (
    <span className={mine ? 'rounded-sm outline outline-2 outline-primary outline-offset-1' : undefined}>
      <svg aria-hidden="true" className={`${size === 'S' ? 'size-4' : 'size-6'} ${brand ? 'stroke-[2.25]' : 'stroke-[1.5]'} ${stateClass}`} style={animationStyle} viewBox="0 0 24 24">
        <path d="M12 3 22 11V21H2V11Z" />
      </svg>
    </span>
  )
}

export function Roofline({ houses, counts }: {
  houses: RooflineHouse[]
  counts: { paid: number; pending: number; unpaid: number }
}) {
  const summary = `ชำระแล้ว ${counts.paid} · รอตรวจ ${counts.pending} · ยังไม่ชำระ ${counts.unpaid}`
  const paidDelays = new Map<number, number>()
  let paidIndex = 0
  houses.forEach((house, index) => {
    if (house.state === 'paid') {
      paidDelays.set(index, Math.min(paidIndex * 15, 600))
      paidIndex += 1
    }
  })

  return (
    <div className="grid justify-items-start gap-3">
      <div aria-label={summary} className="grid w-fit grid-cols-8 gap-1.5" role="img">
        {houses.map((house, index) => (
          <HouseGlyph
            animationDelay={paidDelays.get(index)}
            key={house.key}
            mine={house.mine}
            state={house.state}
          />
        ))}
      </div>
      <p className="text-body font-semibold text-text-heading">{summary}</p>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-caption text-text-muted">
        <span className="inline-flex items-center gap-1.5"><HouseGlyph size="S" state="paid" />ชำระแล้ว</span>
        <span className="inline-flex items-center gap-1.5"><HouseGlyph size="S" state="pending" />รอตรวจ</span>
        <span className="inline-flex items-center gap-1.5"><HouseGlyph size="S" state="unpaid" />ยังไม่ชำระ</span>
      </div>
      {houses.some((house) => house.mine) && <p className="text-caption text-text-muted">กรอบเขียว = บ้านคุณ</p>}
    </div>
  )
}

export function VillageBrandGlyph() {
  return (
    <span aria-hidden="true" className="grid size-11 place-items-center rounded-md bg-primary-container">
      <HouseGlyph brand state="paid" />
    </span>
  )
}
