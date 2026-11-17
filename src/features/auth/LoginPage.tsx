import { useState, type FormEvent } from 'react'
import { Link, useLocation, useNavigate } from 'react-router'
import { Home, KeyRound } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { messages } from '../../lib/messages.th'
import { toThaiError } from '../../lib/errors'
import { useAuth } from './AuthProvider'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { Field, Input } from '../../components/ui/Field'
import { useOffline } from '../../components/layout/OfflineBanner'

export function LoginPage() {
  const { login, authMessage, clearAuthMessage } = useAuth()
  const [identifier, setIdentifier] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const navigate = useNavigate()
  const location = useLocation()
  const offline = useOffline()

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    clearAuthMessage()
    if (!identifier.trim()) return setError(messages.identifierRequired)
    if (!password) return setError(messages.passwordRequired)
    setBusy(true)
    try {
      await login(identifier, password)
      navigate((location.state as { from?: string } | null)?.from ?? '/', { replace: true })
    } catch (caught) {
      setError(toThaiError(caught))
    } finally {
      setBusy(false)
    }
  }

  async function loginWithGoogle() {
    if (!supabase) return
    const { error: oauthError } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/` },
    })
    if (oauthError) setError(messages.generic)
  }

  return (
    <main className="grid min-h-dvh place-items-center bg-canvas px-4 py-10">
      <div className="w-full max-w-md">
        <div className="mb-7 flex items-center gap-3">
          <span className="grid size-14 place-items-center rounded-xl bg-primary-700 text-white"><Home size={28} /></span>
          <div>
            <p className="text-caption font-semibold text-primary-700">หมู่บ้านของเรา</p>
            <h1 className="text-h1 font-bold text-text-heading">เข้าสู่ระบบ</h1>
          </div>
        </div>
        <Card className="p-5 sm:p-7">
          <div className="mb-6 flex items-start gap-3">
            <KeyRound className="mt-1 shrink-0 text-primary-700" size={24} />
            <div>
              <h2 className="text-h2 font-bold text-text-heading">ยินดีต้อนรับ</h2>
              <p className="mt-1 text-body text-text-muted">ใช้บ้านเลขที่หรือเบอร์โทรศัพท์เพื่อเข้าสู่ระบบ</p>
            </div>
          </div>
          <form className="grid gap-5" noValidate onSubmit={handleSubmit}>
            <Field label="บ้านเลขที่ หรือ เบอร์โทรศัพท์">
              <Input autoComplete="username" onChange={(event) => setIdentifier(event.target.value)} placeholder="เช่น 99/12 หรือ 0812345678" required value={identifier} />
            </Field>
            <Field label="รหัสผ่าน">
              <Input autoComplete="current-password" onChange={(event) => setPassword(event.target.value)} required type="password" value={password} />
            </Field>
            {(error || authMessage) && <p aria-live="polite" className="rounded-md bg-red-50 p-3 text-body text-red-700">{error || authMessage}</p>}
            {offline && <p className="text-body text-amber-800">{messages.offlineLogin}</p>}
            <Button busy={busy} className="w-full" disabled={offline} type="submit">เข้าสู่ระบบ</Button>
            {import.meta.env.VITE_ENABLE_GOOGLE_LOGIN === 'true' && (
              <Button className="w-full" disabled={offline} onClick={loginWithGoogle} type="button" variant="secondary">เข้าสู่ระบบด้วย Google</Button>
            )}
          </form>
          <Link className="mt-3 flex min-h-touch items-center justify-center text-primary-700" to="/forgot-password">ลืมรหัสผ่าน?</Link>
        </Card>
      </div>
    </main>
  )
}
