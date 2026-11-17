import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { Field, Input } from '../../components/ui/Field'
import { supabase } from '../../lib/supabase'
import { messages } from '../../lib/messages.th'
import { toThaiError } from '../../lib/errors'
import { useOffline } from '../../components/layout/OfflineBanner'
import { useToast } from '../../components/ui/Toast'
import { useAuth } from './AuthProvider'

export function ChangePasswordPage() {
  const [currentPassword, setCurrentPassword] = useState('')
  const [password, setPassword] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const navigate = useNavigate()
  const offline = useOffline()
  const { showToast } = useToast()
  const { profile, session, refreshProfile } = useAuth()
  const forced = profile?.must_change_password ?? true

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    if (!forced && !currentPassword) return setError(messages.currentPasswordRequired)
    if (!password) return setError(messages.passwordRequired)
    if (password.length < 8) return setError(messages.passwordTooShort)
    if (!confirmation) return setError(messages.passwordRequired)
    if (password !== confirmation) return setError(messages.passwordMismatch)
    if (!forced && password === currentPassword) return setError(messages.passwordSameAsCurrent)
    if (!supabase) return
    setBusy(true)
    if (!forced) {
      if (!session?.user.email) {
        setError(messages.currentPasswordWrong)
        setBusy(false)
        return
      }
      try {
        const { error: currentPasswordError } = await supabase.auth.signInWithPassword({
          email: session.user.email,
          password: currentPassword,
        })
        if (currentPasswordError) {
          setError(messages.currentPasswordWrong)
          setBusy(false)
          return
        }
      } catch {
        setError(messages.currentPasswordWrong)
        setBusy(false)
        return
      }
    }
    try {
      const { error: updateError } = await supabase.auth.updateUser({ password })
      if (updateError) {
        setError(toThaiError(updateError))
        setBusy(false)
        return
      }
      const { error: markError } = await supabase.rpc('mark_password_changed')
      if (markError) {
        setError(toThaiError(markError))
        setBusy(false)
        return
      }
      await refreshProfile()
      showToast(messages.passwordChanged)
      navigate(forced ? '/' : '/profile', { replace: true })
    } catch (caught) {
      setError(toThaiError(caught))
    } finally {
      setBusy(false)
    }
  }

  return (
    <main className="grid min-h-dvh place-items-center bg-canvas px-4 py-10">
      <Card className="w-full max-w-lg">
        <h1 className="mb-2 text-h1 font-bold text-text-heading">เปลี่ยนรหัสผ่าน</h1>
        <p className="mb-6 text-body text-text-muted">{forced ? 'กรุณาตั้งรหัสผ่านใหม่ก่อนเริ่มใช้งาน' : 'กรอกรหัสผ่านปัจจุบันและตั้งรหัสผ่านใหม่'}</p>
        <form className="grid gap-5" noValidate onSubmit={submit}>
          {!forced && <Field label="รหัสผ่านปัจจุบัน"><Input autoComplete="current-password" onChange={(event) => setCurrentPassword(event.target.value)} required type="password" value={currentPassword} /></Field>}
          <Field label="รหัสผ่านใหม่"><Input autoComplete="new-password" minLength={8} onChange={(event) => setPassword(event.target.value)} required type="password" value={password} /></Field>
          <Field label="ยืนยันรหัสผ่านใหม่"><Input autoComplete="new-password" onChange={(event) => setConfirmation(event.target.value)} required type="password" value={confirmation} /></Field>
          {error && <p className="text-body text-red-700">{error}</p>}
          {offline && <p className="text-body text-amber-800">{messages.offlinePassword}</p>}
          <Button busy={busy} disabled={offline} type="submit">บันทึกรหัสผ่าน</Button>
        </form>
        {!forced && <Link className="mt-3 flex min-h-touch items-center rounded-md px-3 font-semibold text-primary-700 hover:bg-primary-50" to="/profile">ย้อนกลับ</Link>}
      </Card>
    </main>
  )
}
