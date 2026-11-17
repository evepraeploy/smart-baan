import { useEffect, useState } from 'react'
import { Phone } from 'lucide-react'
import { supabase } from '../../lib/supabase'

type Hotline = { name: string; phone: string }

export function QuickCallBar() {
  const [hotlines, setHotlines] = useState<Hotline[]>([])
  useEffect(() => {
    if (!supabase) return
    void supabase.from('settings').select('hotlines').eq('id', 1).maybeSingle().then(({ data }) => {
      const entries = Array.isArray(data?.hotlines) ? data.hotlines : []
      setHotlines(entries.filter((entry): entry is Hotline => (
        typeof entry === 'object'
        && entry !== null
        && 'name' in entry
        && 'phone' in entry
        && typeof entry.name === 'string'
        && typeof entry.phone === 'string'
      )).slice(0, 4))
    })
  }, [])

  if (!hotlines.length) return null
  return (
    <section className="grid gap-3">
      <h2 className="text-h2 font-bold text-text-heading">โทรด่วน</h2>
      <div className="grid gap-3 sm:grid-cols-2">
        {hotlines.map((hotline) => {
          const emergency = hotline.name.includes('รปภ.')
          return (
            <a
              className={`flex min-h-control items-center gap-3 rounded-md border bg-white px-4 font-semibold ${emergency ? 'border-amber-700 text-amber-700' : 'border-primary-700 text-primary-700'}`}
              href={`tel:${hotline.phone}`}
              key={`${hotline.name}-${hotline.phone}`}
            >
              <Phone aria-hidden="true" size={21} />
              <span className="flex-1">{hotline.name}<span className="block text-caption font-normal text-text-muted">{hotline.phone}</span></span>
              <span>โทร</span>
            </a>
          )
        })}
      </div>
    </section>
  )
}
