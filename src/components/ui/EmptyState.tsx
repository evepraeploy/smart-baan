import type { LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'
import { IconTile } from './IconTile'

export function EmptyState({ icon: Icon, title, description, action }: {
  icon: LucideIcon
  title: string
  description?: string
  action?: ReactNode
}) {
  return (
    <div className="grid justify-items-center gap-3 py-12 text-center">
      <IconTile icon={Icon} size="XL" tone="neutral" />
      <h3 className="text-h3 font-bold text-text-heading">{title}</h3>
      {description && <p className="max-w-md text-body text-text-muted">{description}</p>}
      {action}
    </div>
  )
}
