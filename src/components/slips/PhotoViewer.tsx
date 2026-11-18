import { useEffect, useState } from 'react'
import { X, ZoomIn, ZoomOut } from 'lucide-react'

export function PhotoViewer({ src, alt, onClose }: { src: string | null; alt: string; onClose: () => void }) {
  const [zoomed, setZoomed] = useState(false)
  useEffect(() => {
    if (!src) return
    const originalOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose() }
    window.addEventListener('keydown', closeOnEscape)
    return () => {
      document.body.style.overflow = originalOverflow
      window.removeEventListener('keydown', closeOnEscape)
    }
  }, [onClose, src])
  if (!src) return null
  return (
    <div className="fixed inset-0 z-[70] grid place-items-center bg-[rgb(13_28_47/0.95)] p-3">
      <button aria-label="ปิดรูป" className="absolute right-3 top-3 grid size-12 place-items-center rounded-full bg-white/10 text-white" onClick={onClose} type="button"><X aria-hidden="true" size={24} /></button>
      <button aria-label={zoomed ? 'ย่อรูป' : 'ขยายรูป'} className="absolute right-3 top-16 grid size-12 place-items-center rounded-full bg-white/10 text-white" onClick={() => setZoomed((value) => !value)} type="button">
        {zoomed ? <ZoomOut aria-hidden="true" size={22} /> : <ZoomIn aria-hidden="true" size={22} />}
      </button>
      <div className="max-h-full max-w-full overflow-auto" onClick={() => setZoomed((value) => !value)} style={{ touchAction: 'pinch-zoom pan-x pan-y' }}>
        <img alt={alt} className={zoomed ? 'max-w-none scale-[2] object-contain' : 'max-h-[90dvh] max-w-full object-contain'} src={src} />
      </div>
    </div>
  )
}
