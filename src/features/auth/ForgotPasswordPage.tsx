import { useState, type FormEvent } from 'react'
import { Link } from 'react-router'
import { Copy, Home, KeyRound } from 'lucide-react'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { Field, Input } from '../../components/ui/Field'
import { useOffline } from '../../components/layout/OfflineBanner'
import { messages } from '../../lib/messages.th'
import { toThaiError } from '../../lib/errors'
import { supabase } from '../../lib/supabase'

function recoveryError(code?: string) {
  if (code === 'RECOVERY_LOCKED') return messages.recoveryLocked
  if (code === 'RECOVERY_INVALID') return messages.recoveryInvalid
  if (code === 'RECOVERY_UNAVAILABLE') return messages.recoveryUnavailable
  if (code === 'INVALID_PASSWORD') return messages.passwordTooShort
  return ''
}

export function ForgotPasswordPage() {
  const [identifier, setIdentifier] = useState('')
  const [recoveryCode, setRecoveryCode] = useState('')
  const [password, setPassword] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [contactPhone, setContactPhone] = useState('')
  const [note, setNote] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [newCode, setNewCode] = useState('')
  const [requestOpen, setRequestOpen] = useState(false)
  const [requestSent, setRequestSent] = useState(false)
  const offline = useOffline()

  async function recover(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    if (!identifier.trim()) return setError(messages.identifierRequired)
    if (!recoveryCode.trim()) return setError(messages.recoveryInvalid)
    if (password.length < 8) return setError(messages.passwordTooShort)
    if (password !== confirmation) return setError(messages.passwordMismatch)
    if (!supabase) return setError(messages.generic)
    setBusy(true)
    try {
      const { data, error: invokeError } = await supabase.functions.invoke('recover-password', {
        body: { identifier: identifier.trim(), code: recoveryCode, new_password: password },
      })
      if (invokeError || data?.error) {
        let code = typeof data?.error === 'string' ? data.error : undefined
        const context = (invokeError as { context?: Response } | null)?.context
        if (!code && context) {
          code = (await context.clone().json().catch(() => ({}))).error
        }
        setError(recoveryError(code) || (invokeError ? toThaiError(invokeError) : messages.generic))
        return
      }
      setNewCode(data.new_code)
      setRecoveryCode('')
      setPassword('')
      setConfirmation('')
    } catch (caught) { setError(toThaiError(caught)) }
    finally { setBusy(false) }
  }

  async function sendRequest(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    if (!identifier.trim()) return setError(messages.identifierRequired)
    if (!supabase) return setError(messages.generic)
    setBusy(true)
    try {
      const { error: requestError } = await supabase.rpc('request_password_reset', {
        p_identifier: identifier.trim(), p_contact_phone: contactPhone.trim() || null, p_note: note.trim() || null,
      })
      if (requestError) throw requestError
      setRequestSent(true)
    } catch (caught) { setError(toThaiError(caught)) }
    finally { setBusy(false) }
  }

  async function copyCode() {
    try { await navigator.clipboard.writeText(newCode) }
    catch { setError(messages.generic) }
  }

  return (
    <main className="grid min-h-dvh place-items-center bg-canvas px-4 py-10">
      <div className="w-full max-w-md">
        <div className="mb-7 flex items-center gap-3">
          <span className="grid size-14 place-items-center rounded-xl bg-primary-container text-white"><Home size={28} /></span>
          <div><p className="text-caption font-semibold text-primary">หมู่บ้านของเรา</p><h1 className="font-display text-h1 font-bold text-text-heading">ลืมรหัสผ่าน</h1></div>
        </div>
        <Card className="p-5 sm:p-7">
          {newCode ? <div className="grid gap-4 text-center">
            <h2 className="font-display text-h2 font-bold text-text-heading">ตั้งรหัสผ่านใหม่เรียบร้อยแล้ว</h2>
            <p className="font-display text-h1 font-bold tracking-normal text-text-heading tabular-nums">{newCode}</p>
            <p className="text-body text-text-muted">รหัสเดิมใช้ไม่ได้แล้ว เก็บรหัสใหม่นี้ไว้</p>
            <Button className="w-full" onClick={() => void copyCode()} variant="secondary"><Copy aria-hidden="true" size={20} />คัดลอกรหัสใหม่</Button>
            <Link className="flex min-h-touch items-center justify-center rounded-md bg-primary-container font-semibold text-white" to="/login">เข้าสู่ระบบ</Link>
          </div> : <>
            <div className="mb-6 flex items-start gap-3">
              <KeyRound aria-hidden="true" className="mt-1 shrink-0 text-primary" size={24} />
              <div><h2 className="font-display text-h2 font-bold text-text-heading">ตั้งรหัสผ่านใหม่ด้วยรหัสกู้คืน</h2><p className="mt-1 text-body text-text-muted">ใช้รหัสที่ได้รับจากผู้ดูแลระบบ</p></div>
            </div>
            <form className="grid gap-4" noValidate onSubmit={recover}>
              <Field label="บ้านเลขที่หรือเบอร์โทร"><Input autoComplete="username" onChange={(event) => setIdentifier(event.target.value)} required value={identifier} /></Field>
              <Field label="รหัสกู้คืน"><Input autoCapitalize="characters" autoComplete="one-time-code" onChange={(event) => setRecoveryCode(event.target.value)} required value={recoveryCode} /></Field>
              <Field label="รหัสผ่านใหม่"><Input autoComplete="new-password" minLength={8} onChange={(event) => setPassword(event.target.value)} required type="password" value={password} /></Field>
              <Field label="ยืนยันรหัสผ่านใหม่"><Input autoComplete="new-password" onChange={(event) => setConfirmation(event.target.value)} required type="password" value={confirmation} /></Field>
              {error && <p aria-live="polite" className="rounded-md bg-tint-danger p-3 text-body text-danger">{error}</p>}
              {offline && <p className="text-body text-secondary">{messages.offlineLogin}</p>}
              <Button busy={busy} className="w-full" disabled={offline} type="submit">ตั้งรหัสผ่านใหม่</Button>
            </form>
            <button className="mt-5 min-h-touch w-full text-body font-semibold text-primary" onClick={() => setRequestOpen((open) => !open)} type="button">ไม่มีรหัสกู้คืน? ส่งคำขอให้ผู้ดูแล</button>
            {requestOpen && (requestSent ? <p aria-live="polite" className="mt-3 text-body text-text-body">{messages.resetRequestSent}</p> : <form className="mt-3 grid gap-4 border-t border-outline-soft pt-4" onSubmit={sendRequest}>
              <Field label="เบอร์ติดต่อกลับ (ไม่บังคับ)"><Input autoComplete="tel" inputMode="tel" onChange={(event) => setContactPhone(event.target.value)} type="tel" value={contactPhone} /></Field>
              <Field label="หมายเหตุถึงผู้ดูแล (ไม่บังคับ)"><Input maxLength={500} onChange={(event) => setNote(event.target.value)} value={note} /></Field>
              <Button busy={busy} disabled={offline} type="submit" variant="outline">ส่งคำขอ</Button>
            </form>)}
            <Link className="mt-3 flex min-h-touch items-center justify-center text-primary" to="/login">กลับไปหน้าเข้าสู่ระบบ</Link>
          </>}
        </Card>
      </div>
    </main>
  )
}
