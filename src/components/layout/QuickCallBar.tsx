import { Phone, ShieldCheck } from 'lucide-react'
import { Card } from '../ui/Card'
import { IconTile } from '../ui/IconTile'
import { useHotlines, type Hotline } from './useHotlines'

export function HotlineList({ hotlines }: { hotlines: Hotline[] }) {
  return (
    <div className="grid gap-3">
      {hotlines.map((hotline) => {
        const emergency = hotline.name.includes('รปภ.')
        const Icon = emergency ? ShieldCheck : Phone
        return (
          <div className="flex min-w-0 items-center gap-3 rounded-lg bg-surface-low p-3 sm:p-4" key={`${hotline.name}-${hotline.phone}`}>
            <IconTile icon={Icon} size="M" tone={emergency ? 'danger' : 'neutral'} />
            <div className="min-w-0 flex-1">
              <h3 className="text-h3 font-bold text-text-heading">{hotline.name}</h3>
              <p className="text-body text-text-muted">{hotline.phone}</p>
            </div>
            <a
              className="inline-flex min-h-touch min-w-touch items-center justify-center gap-2 rounded-md bg-primary-container px-4 text-[18px] leading-7 font-semibold text-white shadow-card transition duration-150 ease-out hover:bg-primary active:scale-[0.98] active:bg-primary-pressed"
              href={`tel:${hotline.phone}`}
            >
              <Phone aria-hidden="true" size={20} />
              โทร
            </a>
          </div>
        )
      })}
    </div>
  )
}

export function QuickCallBar({ id = 'hotlines' }: { id?: string }) {
  const hotlines = useHotlines()
  if (!hotlines.length) return null
  return (
    <Card className="grid scroll-mt-24 gap-3" id={id}>
      <div className="flex items-center gap-3">
        <IconTile icon={ShieldCheck} size="M" tone="danger" />
        <h2 className="font-display text-h2 font-semibold text-text-heading">ติดต่อด่วน</h2>
      </div>
      <HotlineList hotlines={hotlines} />
    </Card>
  )
}
