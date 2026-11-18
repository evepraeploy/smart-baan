import { useState } from 'react'
import { Link } from 'react-router'
import { LogOut, UserRound } from 'lucide-react'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { useAuth, type AppRole } from './AuthProvider'
import { useToast } from '../../components/ui/Toast'
import { supabase } from '../../lib/supabase'
import { toThaiError } from '../../lib/errors'

export function ProfilePage() {
  const { profile, roles, house, logout } = useAuth()
  const { showToast } = useToast()
  const [busy, setBusy] = useState(false)
  const roleLabels: Record<AppRole, string> = { resident: 'ลูกบ้าน', committee: 'กรรมการ', admin: 'ผู้ดูแลระบบ' }
  async function linkGoogle() {
    if (!supabase) return
    const { error } = await supabase.auth.linkIdentity({ provider: 'google', options: { redirectTo: `${window.location.origin}/profile` } })
    if (error) showToast(toThaiError(error), 'error')
  }
  async function signOut() {
    setBusy(true)
    await logout()
  }
  return (
    <div className="grid gap-5">
      <Card>
        <div className="mb-5 flex items-center gap-3">
          <span className="grid size-14 place-items-center rounded-full bg-primary-fixed text-on-primary-fixed"><UserRound size={26} /></span>
          <div><h1 className="font-display text-h1 font-bold text-text-heading">{profile?.display_name}</h1><p className="text-body text-text-muted">{house ? `บ้านเลขที่ ${house.house_no}` : 'ไม่มีบ้านที่ผูกไว้'}</p></div>
        </div>
        <dl className="grid gap-3 text-body">
          <div><dt className="font-semibold text-text-heading">บทบาท</dt><dd className="text-text-muted">{roles.map((role) => roleLabels[role]).join(', ')}</dd></div>
          {profile?.phone && <div><dt className="font-semibold text-text-heading">เบอร์โทรศัพท์</dt><dd className="text-text-muted">{profile.phone}</dd></div>}
        </dl>
      </Card>
      <Card className="grid gap-3">
        <Link className="flex min-h-touch items-center rounded-md px-3 font-semibold text-primary hover:bg-surface-low" to="/change-password">เปลี่ยนรหัสผ่าน</Link>
        {import.meta.env.VITE_ENABLE_GOOGLE_LOGIN === 'true' && <Button onClick={linkGoogle} variant="secondary">ผูกบัญชี Google</Button>}
        <Button busy={busy} onClick={signOut} variant="danger-outline"><LogOut size={20} />ออกจากระบบ</Button>
      </Card>
    </div>
  )
}
