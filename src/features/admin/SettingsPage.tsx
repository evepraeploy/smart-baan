import { useEffect, useState, type FormEvent } from 'react'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { Field, Input } from '../../components/ui/Field'
import { Spinner } from '../../components/ui/Spinner'
import { useOffline } from '../../components/layout/OfflineBanner'
import { useToast } from '../../components/ui/Toast'
import { supabase } from '../../lib/supabase'
import { labels, messages } from '../../lib/messages.th'
import { toThaiError } from '../../lib/errors'

type Hotline = { name: string; phone: string }
type Settings = {
  village_name: string
  monthly_fee: number
  bill_due_day: number
  bank_name: string | null
  bank_account_no: string | null
  bank_account_name: string | null
  hotlines: Hotline[]
}

const emptySettings: Settings = {
  village_name: '',
  monthly_fee: 500,
  bill_due_day: 5,
  bank_name: '',
  bank_account_no: '',
  bank_account_name: '',
  hotlines: [],
}

export function SettingsPage() {
  const [settings, setSettings] = useState<Settings>(emptySettings)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const { showToast } = useToast()
  const offline = useOffline()

  useEffect(() => {
    let active = true
    if (!supabase) return
    void (async () => {
      try {
        const { data, error: queryError } = await supabase
          .from('settings')
          .select('village_name,monthly_fee,bill_due_day,bank_name,bank_account_no,bank_account_name,hotlines')
          .eq('id', 1)
          .maybeSingle()
        if (!active) return
        if (queryError) setError(toThaiError(queryError))
        else if (data) setSettings({
          ...emptySettings,
          ...data,
          hotlines: Array.isArray(data.hotlines) ? data.hotlines as Hotline[] : [],
        })
      } catch (caught) {
        if (active) setError(toThaiError(caught))
      } finally {
        if (active) setLoading(false)
      }
    })()
    return () => { active = false }
  }, [])

  function updateHotline(index: number, field: keyof Hotline, value: string) {
    setSettings((current) => ({
      ...current,
      hotlines: current.hotlines.map((entry, currentIndex) => currentIndex === index ? { ...entry, [field]: value } : entry),
    }))
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    if (!settings.village_name.trim()) return setError(messages.villageNameRequired)
    if (!Number.isFinite(settings.monthly_fee) || settings.monthly_fee < 0 || settings.bill_due_day < 1 || settings.bill_due_day > 28) {
      return setError(messages.settingsInvalid)
    }
    if (!supabase) return
    setBusy(true)
    const { error: updateError } = await supabase.from('settings').update({
      village_name: settings.village_name.trim(),
      monthly_fee: settings.monthly_fee,
      bill_due_day: settings.bill_due_day,
      bank_name: settings.bank_name?.trim() || null,
      bank_account_no: settings.bank_account_no?.trim() || null,
      bank_account_name: settings.bank_account_name?.trim() || null,
      hotlines: settings.hotlines.filter((entry) => entry.name.trim() && entry.phone.trim()),
      updated_at: new Date().toISOString(),
    }).eq('id', 1)
    setBusy(false)
    if (updateError) setError(toThaiError(updateError))
    else showToast('บันทึกการตั้งค่าเรียบร้อยแล้ว')
  }

  if (loading) return <Spinner />
  return (
    <div className="mx-auto grid max-w-3xl gap-5">
      <div><h1 className="text-h1 font-bold text-text-heading">ตั้งค่าหมู่บ้าน</h1><p className="text-body text-text-muted">ข้อมูลที่ใช้แสดงในระบบและข้อมูลสำหรับชำระค่าส่วนกลาง</p></div>
      <Card>
        <form className="grid gap-5" noValidate onSubmit={save}>
          <Field label="ชื่อหมู่บ้าน"><Input onChange={(event) => setSettings({ ...settings, village_name: event.target.value })} required value={settings.village_name} /></Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="ค่าส่วนกลางต่อเดือน"><Input inputMode="decimal" min="0" onChange={(event) => setSettings({ ...settings, monthly_fee: Number(event.target.value) })} required type="number" value={settings.monthly_fee} /></Field>
            <Field label="วันครบกำหนดชำระ"><Input max="28" min="1" onChange={(event) => setSettings({ ...settings, bill_due_day: Number(event.target.value) })} required type="number" value={settings.bill_due_day} /></Field>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="ธนาคาร"><Input onChange={(event) => setSettings({ ...settings, bank_name: event.target.value })} value={settings.bank_name ?? ''} /></Field>
            <Field label="เลขที่บัญชี"><Input onChange={(event) => setSettings({ ...settings, bank_account_no: event.target.value })} value={settings.bank_account_no ?? ''} /></Field>
          </div>
          <Field label="ชื่อบัญชี"><Input onChange={(event) => setSettings({ ...settings, bank_account_name: event.target.value })} value={settings.bank_account_name ?? ''} /></Field>
          <fieldset className="grid gap-3">
            <legend className="text-body font-semibold text-text-heading">เบอร์โทรด่วน (ไม่เกิน 4 รายการ)</legend>
            {settings.hotlines.map((hotline, index) => (
              <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto]" key={`${index}-${hotline.name}`}>
                <Field label={`ชื่อผู้ติดต่อ ${index + 1}`}><Input onChange={(event) => updateHotline(index, 'name', event.target.value)} value={hotline.name} /></Field>
                <Field label="เบอร์โทรศัพท์"><Input onChange={(event) => updateHotline(index, 'phone', event.target.value)} value={hotline.phone} /></Field>
                <Button className="self-end" onClick={() => setSettings({ ...settings, hotlines: settings.hotlines.filter((_, currentIndex) => currentIndex !== index) })} type="button" variant="danger-outline">ลบ</Button>
              </div>
            ))}
            {settings.hotlines.length < 4 && <Button onClick={() => setSettings({ ...settings, hotlines: [...settings.hotlines, { name: '', phone: '' }] })} type="button" variant="secondary">เพิ่มเบอร์โทร</Button>}
          </fieldset>
          {error && <p aria-live="polite" className="text-body text-red-700">{error}</p>}
          {offline && <p className="text-body text-amber-800">{messages.offlineSettings}</p>}
          <Button busy={busy} disabled={offline} type="submit">{labels.save}การตั้งค่า</Button>
        </form>
      </Card>
    </div>
  )
}
