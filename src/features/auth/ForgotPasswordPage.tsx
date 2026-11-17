import { useState, type FormEvent } from 'react'
import { Link } from 'react-router'
import { Home, KeyRound } from 'lucide-react'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { Field, Input } from '../../components/ui/Field'
import { useOffline } from '../../components/layout/OfflineBanner'
import { messages } from '../../lib/messages.th'
import { toThaiError } from '../../lib/errors'
import { supabase } from '../../lib/supabase'

export function ForgotPasswordPage() {
  const [identifier, setIdentifier] = useState('')
  const [contactPhone, setContactPhone] = useState('')
  const [note, setNote] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [sent, setSent] = useState(false)
  const offline = useOffline()

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    if (!identifier.trim()) return setError(messages.identifierRequired)
    if (!supabase) return
    setBusy(true)
    try {
      const { error: requestError } = await supabase.rpc('request_password_reset', {
        p_identifier: identifier.trim(),
        p_contact_phone: contactPhone.trim() || null,
        p_note: note.trim() || null,
      })
      if (requestError) {
        setError(toThaiError(requestError))
        return
      }
      setSent(true)
    } catch (caught) {
      setError(toThaiError(caught))
    } finally {
      setBusy(false)
    }
  }

  return (
    <main className="grid min-h-dvh place-items-center bg-canvas px-4 py-10">
      <div className="w-full max-w-md">
        <div className="mb-7 flex items-center gap-3">
          <span className="grid size-14 place-items-center rounded-xl bg-primary-700 text-white"><Home size={28} /></span>
          <div>
            <p className="text-caption font-semibold text-primary-700">หมู่บ้านของเรา</p>
            <h1 className="text-h1 font-bold text-text-heading">ลืมรหัสผ่าน</h1>
          </div>
        </div>
        <Card className="p-5 sm:p-7">
          {sent ? (
            <div className="grid gap-4">
              <div className="flex items-start gap-3">
                <KeyRound aria-hidden="true" className="mt-1 shrink-0 text-primary-700" size={24} />
                <p aria-live="polite" className="text-body text-text-heading">{messages.resetRequestSent}</p>
              </div>
              <Link className="flex min-h-touch items-center justify-center rounded-md font-semibold text-primary-700 hover:bg-primary-50" to="/login">กลับไปหน้าเข้าสู่ระบบ</Link>
            </div>
          ) : (
            <>
              <div className="mb-6 flex items-start gap-3">
                <KeyRound aria-hidden="true" className="mt-1 shrink-0 text-primary-700" size={24} />
                <div>
                  <h2 className="text-h2 font-bold text-text-heading">ขอรหัสผ่านชั่วคราว</h2>
                  <p className="mt-1 text-body text-text-muted">กรอกข้อมูลเพื่อให้ผู้ดูแลระบบติดต่อกลับ</p>
                </div>
              </div>
              <form className="grid gap-5" noValidate onSubmit={handleSubmit}>
                <Field label="บ้านเลขที่ หรือ เบอร์โทรศัพท์">
                  <Input autoComplete="username" onChange={(event) => setIdentifier(event.target.value)} required value={identifier} />
                </Field>
                <Field label="เบอร์ติดต่อกลับ (ไม่บังคับ)">
                  <Input autoComplete="tel" onChange={(event) => setContactPhone(event.target.value)} type="tel" value={contactPhone} />
                </Field>
                <Field label="หมายเหตุถึงผู้ดูแล (ไม่บังคับ)">
                  <Input maxLength={500} onChange={(event) => setNote(event.target.value)} value={note} />
                </Field>
                {error && <p aria-live="polite" className="rounded-md bg-red-50 p-3 text-body text-red-700">{error}</p>}
                {offline && <p className="text-body text-amber-800">{messages.offlineLogin}</p>}
                <Button busy={busy} className="w-full" disabled={offline} type="submit">ส่งคำขอ</Button>
                <Link className="flex min-h-touch items-center justify-center text-primary-700" to="/login">กลับไปหน้าเข้าสู่ระบบ</Link>
              </form>
            </>
          )}
        </Card>
      </div>
    </main>
  )
}
