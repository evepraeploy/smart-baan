import { useEffect, type ReactNode } from 'react'
import { X } from 'lucide-react'
import { Button } from './Button'

type Props = {
  title: string
  open: boolean
  onClose: () => void
  children: ReactNode
  footer?: ReactNode
  busy?: boolean
}

export function Modal({ title, open, onClose, children, footer, busy = false }: Props) {
  useEffect(() => {
    if (!open) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !busy) onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [busy, onClose, open])
  if (!open) return null
  return (
    <div
      className="fixed inset-0 z-50 grid items-end bg-[rgb(13_28_47/0.6)] p-0 md:place-items-center md:p-6"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !busy) onClose()
      }}
    >
      <section
        aria-labelledby="modal-title"
        aria-modal="true"
        className="max-h-[min(90dvh,48rem)] w-full max-w-lg overflow-y-auto rounded-t-xl bg-surface px-6 pb-[calc(24px+env(safe-area-inset-bottom))] pt-6 shadow-modal md:rounded-xl md:p-6"
        role="dialog"
      >
        <div aria-hidden="true" className="mx-auto mb-5 h-1 w-10 rounded-full bg-outline md:hidden" />
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-display text-h2 font-bold text-text-heading" id="modal-title">{title}</h2>
          <Button aria-label="ปิดหน้าต่าง" className="min-h-touch min-w-touch p-0" disabled={busy} onClick={onClose} variant="quiet">
            <X aria-hidden="true" size={24} />
          </Button>
        </div>
        <div>{children}</div>
        {footer && <div className="mt-6 flex flex-col-reverse gap-3 md:flex-row md:justify-end">{footer}</div>}
      </section>
    </div>
  )
}
