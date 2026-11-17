import { useEffect, useState } from 'react'
import { WifiOff } from 'lucide-react'
import { messages } from '../../lib/messages.th'

export function useOffline() {
  const [offline, setOffline] = useState(!navigator.onLine)
  useEffect(() => {
    const online = () => setOffline(false)
    const offlineEvent = () => setOffline(true)
    window.addEventListener('online', online)
    window.addEventListener('offline', offlineEvent)
    return () => {
      window.removeEventListener('online', online)
      window.removeEventListener('offline', offlineEvent)
    }
  }, [])
  return offline
}

export function OfflineBanner() {
  const offline = useOffline()
  if (!offline) return null
  return (
    <div className="flex min-h-12 items-center gap-2 bg-amber-50 px-4 py-2 text-body font-semibold text-amber-800" role="status">
      <WifiOff aria-hidden="true" size={20} />
      {messages.offline}
    </div>
  )
}
