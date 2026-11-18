import { useCallback, useEffect, useState } from 'react'
import { KeyRound, RefreshCw } from 'lucide-react'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { EmptyState } from '../../components/ui/EmptyState'
import { Spinner } from '../../components/ui/Spinner'
import { useToast } from '../../components/ui/Toast'
import { useOffline } from '../../components/layout/OfflineBanner'
import { toThaiError } from '../../lib/errors'
import { formatDateTimeTH } from '../../lib/format'
import { messages } from '../../lib/messages.th'
import { adminUserAction, closePasswordResetRequest, listPasswordResetRequests, type PasswordResetRequest } from './api'

export function PasswordRequestsPage() {
  const { showToast } = useToast()
  const offline = useOffline()
  const [requests, setRequests] = useState<PasswordResetRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const refresh = useCallback(async () => {
    setLoading(true)
    try {
      setRequests(await listPasswordResetRequests())
      setError('')
    } catch (caught) {
      setError(toThaiError(caught))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void refresh() }, [refresh])

  async function resetPassword(request: PasswordResetRequest) {
    const password = window.prompt('กำหนดรหัสผ่านชั่วคราวอย่างน้อย 8 ตัวอักษร')
    if (!password) return
    if (password.length < 8) return setError(messages.passwordTooShort)
    setBusy(true)
    setError('')
    try {
      await adminUserAction({
        action: 'reset_password',
        user_id: request.user_id,
        password,
      })
      await closePasswordResetRequest(request.id, 'resolved')
      showToast('ตั้งรหัสผ่านชั่วคราวแล้ว กรุณาแจ้งรหัสให้ผู้ใช้ ผู้ใช้ต้องเปลี่ยนรหัสเมื่อเข้าสู่ระบบ')
      await refresh()
    } catch (caught) {
      setError(toThaiError(caught))
    } finally {
      setBusy(false)
    }
  }

  async function dismissRequest(request: PasswordResetRequest) {
    if (!window.confirm('ปิดคำขอนี้ใช่หรือไม่?')) return
    setBusy(true)
    setError('')
    try {
      await closePasswordResetRequest(request.id, 'dismissed')
      showToast('ปิดคำขอเรียบร้อยแล้ว')
      await refresh()
    } catch (caught) {
      setError(toThaiError(caught))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="grid gap-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-h1 font-bold text-text-heading">คำขอรีเซ็ตรหัสผ่าน</h1>
          <p className="text-body text-text-muted">ตั้งรหัสผ่านชั่วคราวหรือปิดคำขอที่ไม่ต้องดำเนินการ</p>
        </div>
        <Button onClick={() => void refresh()} variant="secondary"><RefreshCw size={20} />รีเฟรช</Button>
      </div>
      {error && <p aria-live="polite" className="rounded-md bg-tint-danger p-3 text-body text-danger">{error}</p>}
      {offline && <p className="text-body text-secondary">{messages.offlineSettings}</p>}
      {loading ? <Spinner /> : requests.length ? requests.map((request) => (
        <Card className="grid gap-4" key={request.id}>
          <div className="flex items-start gap-3">
            <span className="grid size-11 shrink-0 place-items-center rounded-full bg-primary-fixed text-on-primary-fixed"><KeyRound aria-hidden="true" size={22} /></span>
            <div className="min-w-0">
              <h2 className="font-display text-h2 font-bold text-text-heading">{request.display_name}</h2>
              <p className="break-all text-body text-text-muted">{request.login_identifier}</p>
            </div>
          </div>
          <dl className="grid gap-2 text-body sm:grid-cols-2">
            <div><dt className="font-semibold text-text-heading">บ้านเลขที่</dt><dd className="text-text-muted">{request.house_no || 'ไม่ผูกกับบ้าน'}</dd></div>
            <div><dt className="font-semibold text-text-heading">เบอร์โทรศัพท์</dt><dd className="text-text-muted">{request.phone || 'ไม่มีข้อมูล'}</dd></div>
            <div><dt className="font-semibold text-text-heading">เบอร์ติดต่อกลับ</dt><dd className="text-text-muted">{request.contact_phone || 'ไม่ได้ระบุ'}</dd></div>
            <div><dt className="font-semibold text-text-heading">ส่งคำขอเมื่อ</dt><dd className="text-text-muted">{formatDateTimeTH(request.created_at)}</dd></div>
          </dl>
          {request.note && <p className="text-body text-text-muted"><span className="font-semibold text-text-heading">หมายเหตุ: </span>{request.note}</p>}
          <div className="flex flex-wrap gap-2 border-t border-outline-soft pt-4">
            <Button busy={busy} disabled={offline} onClick={() => void resetPassword(request)}>ตั้งรหัสผ่านชั่วคราว</Button>
            <Button busy={busy} disabled={offline} onClick={() => void dismissRequest(request)} variant="danger-outline">ปิดคำขอ</Button>
          </div>
        </Card>
      )) : !error && (
        <Card><EmptyState description="เมื่อมีผู้ใช้ส่งคำขอ รายการจะปรากฏที่นี่" icon={KeyRound} title="ไม่มีคำขอที่รอดำเนินการ" /></Card>
      )}
    </div>
  )
}
