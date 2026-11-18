import { LoaderCircle } from 'lucide-react'

export function Spinner({ label = 'กำลังโหลดข้อมูล' }: { label?: string }) {
  return (
    <div aria-live="polite" className="flex items-center justify-center gap-3 py-12 text-text-muted">
      <LoaderCircle aria-hidden="true" className="animate-spin text-primary" size={24} />
      <span>{label}</span>
    </div>
  )
}
