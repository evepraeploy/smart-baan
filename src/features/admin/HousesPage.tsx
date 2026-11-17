import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { RefreshCw, UserPlus, Users } from 'lucide-react'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { Field, Input } from '../../components/ui/Field'
import { Select } from '../../components/ui/Select'
import { Spinner } from '../../components/ui/Spinner'
import { useToast } from '../../components/ui/Toast'
import { toThaiError } from '../../lib/errors'
import { messages } from '../../lib/messages.th'
import { useOffline } from '../../components/layout/OfflineBanner'
import type { AppRole } from '../auth/AuthProvider'
import { adminUserAction, getHouses, type ManagedHouse } from './api'

export function HousesPage() {
  const { showToast } = useToast()
  const offline = useOffline()
  const [houses, setHouses] = useState<ManagedHouse[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [form, setForm] = useState({ identifier: '', display_name: '', phone: '', role: 'resident' as AppRole, house_no: '', password: '' })
  const roleLabels: Record<AppRole, string> = { resident: 'ลูกบ้าน', committee: 'กรรมการ', admin: 'ผู้ดูแลระบบ' }
  const refresh = useCallback(async () => {
    setLoading(true)
    try {
      setHouses(await getHouses())
      setError('')
    } catch (caught) {
      setError(toThaiError(caught))
    } finally {
      setLoading(false)
    }
  }, [])
  useEffect(() => { void refresh() }, [refresh])

  async function createUser(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    if (!form.display_name.trim()) return setError(messages.displayNameRequired)
    if (!form.identifier.trim()) return setError(messages.loginIdentifierRequired)
    if (form.password.length < 8) return setError(messages.passwordTooShort)
    setBusy(true)
    setError('')
    try {
      await adminUserAction({ action: 'create_user', ...form })
      showToast('สร้างบัญชีเรียบร้อยแล้ว')
      setForm({ identifier: '', display_name: '', phone: '', role: 'resident', house_no: '', password: '' })
      await refresh()
    } catch (caught) {
      setError(toThaiError(caught))
    } finally {
      setBusy(false)
    }
  }

  async function setActive(userId: string, isActive: boolean) {
    try {
      await adminUserAction({ action: 'set_active', user_id: userId, is_active: isActive })
      showToast(isActive ? 'เปิดใช้งานบัญชีแล้ว' : 'ปิดใช้งานบัญชีแล้ว')
      await refresh()
    } catch (caught) { setError(toThaiError(caught)) }
  }

  async function resetPassword(userId: string) {
    const password = window.prompt('กำหนดรหัสผ่านใหม่อย่างน้อย 8 ตัวอักษร')
    if (!password) return
    if (password.length < 8) return setError(messages.passwordTooShort)
    try {
      await adminUserAction({ action: 'reset_password', user_id: userId, password })
      showToast('ตั้งรหัสผ่านใหม่แล้ว ผู้ใช้ต้องเปลี่ยนรหัสผ่านเมื่อเข้าสู่ระบบ')
    } catch (caught) { setError(toThaiError(caught)) }
  }

  return (
    <div className="grid gap-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div><h1 className="text-h1 font-bold text-text-heading">จัดการลูกบ้าน</h1><p className="text-body text-text-muted">บ้านและบัญชีผู้ใช้ในหมู่บ้าน</p></div>
        <Button onClick={() => void refresh()} variant="secondary"><RefreshCw size={20} />รีเฟรช</Button>
      </div>
      <Card>
        <h2 className="mb-5 flex items-center gap-2 text-h2 font-bold text-text-heading"><UserPlus size={23} />สร้างบัญชีผู้ใช้</h2>
        <form className="grid gap-4 md:grid-cols-2" noValidate onSubmit={createUser}>
          <Field label="ชื่อที่แสดง"><Input onChange={(event) => setForm({ ...form, display_name: event.target.value })} required value={form.display_name} /></Field>
          <Field label="บ้านเลขที่หรือรหัสเข้าใช้"><Input onChange={(event) => setForm({ ...form, identifier: event.target.value })} required value={form.identifier} /></Field>
          <Field label="เบอร์โทรศัพท์ (ไม่บังคับ)"><Input onChange={(event) => setForm({ ...form, phone: event.target.value })} value={form.phone} /></Field>
          <Field label="บทบาท"><Select onChange={(event) => setForm({ ...form, role: event.target.value as AppRole })} value={form.role}><option value="resident">ลูกบ้าน</option><option value="committee">กรรมการ</option><option value="admin">ผู้ดูแลระบบ</option></Select></Field>
          <Field label="บ้านเลขที่ (ถ้ามี)"><Select onChange={(event) => setForm({ ...form, house_no: event.target.value })} value={form.house_no}><option value="">ไม่ผูกกับบ้าน</option>{houses.map((house) => <option key={house.id} value={house.house_no}>{house.house_no}</option>)}</Select></Field>
          <Field label="รหัสผ่านเริ่มต้น"><Input autoComplete="new-password" minLength={8} onChange={(event) => setForm({ ...form, password: event.target.value })} required type="password" value={form.password} /></Field>
          {error && <p className="text-body text-red-700 md:col-span-2">{error}</p>}
          {offline && <p className="text-body text-amber-800 md:col-span-2">{messages.offlineSettings}</p>}
          <Button busy={busy} className="md:col-span-2" disabled={offline} type="submit">สร้างบัญชี</Button>
        </form>
      </Card>
      {loading ? <Spinner /> : houses.map((house) => (
        <Card key={house.id}>
          <div className="mb-4 flex items-center justify-between gap-3">
            <div><h2 className="text-h2 font-bold text-text-heading">บ้านเลขที่ {house.house_no}</h2><p className="text-body text-text-muted">{house.soi || house.owner_name || 'ยังไม่มีข้อมูลเพิ่มเติม'}</p></div>
            <span className={`rounded-full px-3 py-2 text-caption font-semibold ${house.is_active ? 'bg-status-success-bg text-status-success-fg' : 'bg-status-neutral-bg text-status-neutral-fg'}`}>{house.is_active ? 'เปิดใช้งาน' : 'ปิดใช้งาน'}</span>
          </div>
          <div className="grid gap-3">
            {(house.house_members ?? []).map(({ profiles }) => profiles && (
              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-3" key={profiles.id}>
                <div><p className="font-semibold text-text-heading">{profiles.display_name}</p><p className="text-caption text-text-muted">{profiles.phone || 'ไม่มีเบอร์โทร'} · {profiles.user_roles.map((item) => roleLabels[item.role as AppRole] ?? 'ลูกบ้าน').join(', ')}</p></div>
                <div className="flex flex-wrap gap-2">
                  <Button className="min-h-touch px-3" onClick={() => void resetPassword(profiles.id)} variant="secondary">ตั้งรหัสผ่านใหม่</Button>
                  <Button className="min-h-touch px-3" onClick={() => void setActive(profiles.id, !profiles.is_active)} variant={profiles.is_active ? 'danger-outline' : 'secondary'}>{profiles.is_active ? 'ปิดบัญชี' : 'เปิดบัญชี'}</Button>
                </div>
              </div>
            ))}
            {!house.house_members?.length && <p className="flex items-center gap-2 text-body text-text-muted"><Users size={18} />ยังไม่มีบัญชีที่ผูกกับบ้านนี้</p>}
          </div>
        </Card>
      ))}
    </div>
  )
}
