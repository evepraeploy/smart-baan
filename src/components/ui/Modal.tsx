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
      className="fixed inset-0 z-50 grid place-items-end bg-slate-950/50 p-0 sm:place-items-center sm:p-6"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !busy) onClose()
      }}
    >
      <section
        aria-labelledby="modal-title"
        aria-modal="true"
        className="w-full max-w-lg rounded-t-xl bg-white p-5 shadow-modal sm:rounded-xl sm:p-6"
        role="dialog"
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-h2 font-bold text-text-heading" id="modal-title">{title}</h2>
          <Button aria-label="ปิดหน้าต่าง" className="min-h-touch min-w-touch p-0" disabled={busy} onClick={onClose} variant="quiet">
            <X aria-hidden="true" size={24} />
          </Button>
        </div>
        <div>{children}</div>
        {footer && <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">{footer}</div>}
      </section>
    </div>
  )
}
