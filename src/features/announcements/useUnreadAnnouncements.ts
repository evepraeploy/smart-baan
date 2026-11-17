import { useCallback, useEffect, useState } from 'react'
import { useLocation } from 'react-router'
import { useAuth } from '../auth/AuthProvider'
import { countUnreadAnnouncements } from './api'

export function useUnreadAnnouncements(): number {
  const { session } = useAuth()
  const location = useLocation()
  const userId = session?.user.id
  const [count, setCount] = useState(0)
  const refresh = useCallback(async () => {
    if (!userId) {
      setCount(0)
      return
    }
    try {
      setCount(await countUnreadAnnouncements(userId))
    } catch {
      setCount(0)
    }
  }, [userId])

  useEffect(() => { void refresh() }, [location.pathname, refresh])
  useEffect(() => {
    window.addEventListener('announcement-reads-updated', refresh)
    return () => window.removeEventListener('announcement-reads-updated', refresh)
  }, [refresh])

  return count
}
