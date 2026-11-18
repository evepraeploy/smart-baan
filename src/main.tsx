import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import '@fontsource/sarabun/400.css'
import '@fontsource/sarabun/500.css'
import '@fontsource/sarabun/600.css'
import '@fontsource/sarabun/700.css'
import '@fontsource/ibm-plex-sans-thai-looped/600.css'
import '@fontsource/ibm-plex-sans-thai-looped/700.css'
import './styles/theme.css'
import App from './App'
import { AuthProvider } from './features/auth/AuthProvider'
import { ToastProvider } from './components/ui/Toast'
import { isSupabaseConfigured } from './lib/supabase'
import { messages } from './lib/messages.th'
import { Card } from './components/ui/Card'
import { Home } from 'lucide-react'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, staleTime: 30_000, refetchOnWindowFocus: true },
  },
})

function NotConfigured() {
  return (
    <main className="grid min-h-dvh place-items-center bg-canvas px-5 py-10">
      <Card className="grid max-w-lg justify-items-center gap-4 p-7 text-center">
        <span className="grid size-16 place-items-center rounded-xl bg-primary-container text-white"><Home size={32} /></span>
        <h1 className="font-display text-h1 font-bold text-text-heading">{messages.notConfiguredTitle}</h1>
        <p className="text-body-lg text-text-muted">{messages.notConfiguredBody}</p>
      </Card>
    </main>
  )
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    {isSupabaseConfigured ? (
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <AuthProvider>
            <ToastProvider><App /></ToastProvider>
          </AuthProvider>
        </BrowserRouter>
      </QueryClientProvider>
    ) : <NotConfigured />}
  </React.StrictMode>,
)
