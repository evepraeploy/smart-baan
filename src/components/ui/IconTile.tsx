import type { LucideIcon } from 'lucide-react'

type Props = {
  icon: LucideIcon
  tone: 'primary' | 'secondary' | 'neutral' | 'danger'
  size: 'L' | 'M' | 'XL'
}

const tones = {
  primary: 'bg-primary-fixed text-on-primary-fixed',
  secondary: 'bg-secondary-fixed text-on-secondary-fixed',
  neutral: 'bg-surface-high text-primary',
  danger: 'bg-danger-container text-on-danger-container',
}

const sizes = {
  L: 'size-12 rounded-md',
  M: 'size-10 rounded-md',
  XL: 'size-[72px] rounded-lg',
}

const iconSizes = { L: 26, M: 22, XL: 40 }

export function IconTile({ icon: Icon, tone, size }: Props) {
  return (
    <span aria-hidden="true" className={`grid shrink-0 place-items-center ${sizes[size]} ${tones[tone]}`}>
      <Icon size={iconSizes[size]} strokeWidth={size === 'XL' ? 2.25 : 2} />
    </span>
  )
}
