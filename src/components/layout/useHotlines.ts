import { useQuery } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'

export type Hotline = { name: string; phone: string }

async function fetchHotlines(): Promise<Hotline[]> {
  if (!supabase) return []
  const { data } = await supabase.from('settings').select('hotlines').eq('id', 1).maybeSingle()
  const entries = Array.isArray(data?.hotlines) ? data.hotlines : []
  return entries.filter((entry): entry is Hotline => (
    typeof entry === 'object'
    && entry !== null
    && 'name' in entry
    && 'phone' in entry
    && typeof entry.name === 'string'
    && typeof entry.phone === 'string'
  )).slice(0, 4)
}

export function useHotlines() {
  const query = useQuery({ queryKey: ['hotlines'], queryFn: fetchHotlines })
  return query.data ?? []
}
