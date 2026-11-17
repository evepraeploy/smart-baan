import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react'
import { CircleCheck, CircleX, X } from 'lucide-react'

type ToastTone = 'success' | 'error'
type ToastItem = { id: number; message: string; tone: ToastTone }
type ToastContextValue = { showToast: (message: string, tone?: ToastTone) => void }
const ToastContext = createContext<ToastContextValue | null>(null)

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([])
  const dismiss = useCallback((id: number) => setItems((current) => current.filter((item) => item.id !== id)), [])
  const showToast = useCallback((message: string, tone: ToastTone = 'success') => {
    const id = Date.now() + Math.random()
    setItems((current) => [...current, { id, message, tone }])
    if (tone === 'success') window.setTimeout(() => dismiss(id), 5000)
  }, [dismiss])
  const value = useMemo(() => ({ showToast }), [showToast])
  return (
    <ToastContext.Provider value={value}>
      {children}
      <div aria-live="polite" className="fixed left-4 right-4 top-4 z-[70] grid gap-2 sm:left-auto sm:w-[min(28rem,calc(100vw-2rem))]">
        {items.map((item) => {
          const Icon = item.tone === 'success' ? CircleCheck : CircleX
          return (
            <div key={item.id} className={`flex min-h-touch items-center gap-3 rounded-md border bg-white p-3 shadow-card ${item.tone === 'success' ? 'border-status-success-border text-status-success-fg' : 'border-status-danger-border text-status-danger-fg'}`}>
              <Icon aria-hidden="true" size={22} />
              <p className="flex-1 text-body font-semibold">{item.message}</p>
              <button aria-label="ปิดข้อความ" className="min-h-touch min-w-touch" onClick={() => dismiss(item.id)}><X size={20} /></button>
            </div>
          )
        })}
      </div>
    </ToastContext.Provider>
  )
}

export function useToast() {
  const context = useContext(ToastContext)
  if (!context) throw new Error('ToastProvider is required')
  return context
}
