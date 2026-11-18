import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { HardHat, Pencil, Plus, Phone, UserRoundX } from 'lucide-react'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { EmptyState } from '../../components/ui/EmptyState'
import { Field, Input, Textarea } from '../../components/ui/Field'
import { Modal } from '../../components/ui/Modal'
import { Spinner } from '../../components/ui/Spinner'
import { useOffline } from '../../components/layout/OfflineBanner'
import { useToast } from '../../components/ui/Toast'
import { toThaiError } from '../../lib/errors'
import { messages } from '../../lib/messages.th'
import { listContractors, saveContractor, type Contractor } from './api'

type ContractorForm = { name: string; phone: string; trade: string; note: string; is_active: boolean }
const emptyForm: ContractorForm = { name: '', phone: '', trade: '', note: '', is_active: true }

export function ContractorsPage() {
  const { showToast } = useToast()
  const offline = useOffline()
  const [contractors, setContractors] = useState<Contractor[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<Contractor | null>(null)
  const [form, setForm] = useState<ContractorForm>(emptyForm)

  const refresh = useCallback(async () => {
    setLoading(true)
    try {
      setContractors(await listContractors())
      setError('')
    } catch (caught) {
      setError(toThaiError(caught))
    } finally {
      setLoading(false)
    }
  }, [])
  useEffect(() => { void refresh() }, [refresh])

  function openForm(contractor?: Contractor) {
    setEditing(contractor ?? null)
    setForm(contractor ? {
      name: contractor.name,
      phone: contractor.phone ?? '',
      trade: contractor.trade ?? '',
      note: contractor.note ?? '',
      is_active: contractor.is_active,
    } : emptyForm)
    setError('')
    setOpen(true)
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (offline) return setError(messages.offlineTickets)
    if (!form.name.trim()) return setError(messages.contractorNameRequired)
    setBusy(true)
    try {
      await saveContractor(editing?.id ?? null, {
        name: form.name.trim(),
        phone: form.phone.trim() || null,
        trade: form.trade.trim() || null,
        note: form.note.trim() || null,
        is_active: form.is_active,
      })
      showToast(messages.contractorSaved)
      setOpen(false)
      await refresh()
    } catch (caught) {
      setError(toThaiError(caught))
    } finally {
      setBusy(false)
    }
  }

  async function deactivate(contractor: Contractor) {
    if (offline || !window.confirm(`ปิดใช้งาน “${contractor.name}” ใช่หรือไม่?`)) return
    setBusy(true)
    try {
      await saveContractor(contractor.id, { ...contractor, is_active: false })
      showToast(messages.contractorDeactivated)
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
        <div><h1 className="font-display text-h1 font-bold text-text-heading">รายชื่อช่างภายนอก</h1><p className="text-body text-text-muted">รายชื่ออ้างอิงสำหรับมอบหมายงานซ่อม</p></div>
        <Button disabled={offline} onClick={() => openForm()}><Plus aria-hidden="true" size={20} />เพิ่มช่าง</Button>
      </div>
      {offline && <p className="text-body text-secondary">{messages.offlineTickets}</p>}
      {error && <p aria-live="polite" className="rounded-md bg-tint-danger p-3 text-body text-danger">{error}</p>}
      {loading ? <Spinner /> : contractors.length ? contractors.map((contractor) => (
        <Card className="flex flex-wrap items-center justify-between gap-3" key={contractor.id}>
          <div className="flex min-w-0 items-start gap-3">
            <span className="grid size-11 shrink-0 place-items-center rounded-full bg-primary-fixed text-on-primary-fixed"><HardHat aria-hidden="true" size={22} /></span>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2"><h2 className="font-display text-h2 font-bold text-text-heading">{contractor.name}</h2><span className={`rounded-full px-3 py-1 text-caption font-semibold ${contractor.is_active ? 'bg-status-success-bg text-status-success-fg' : 'bg-status-neutral-bg text-status-neutral-fg'}`}>{contractor.is_active ? 'ใช้งาน' : 'ปิดใช้งาน'}</span></div>
              {contractor.trade && <p className="text-body text-text-muted">{contractor.trade}</p>}
              {contractor.phone && <a className="mt-1 inline-flex min-h-touch items-center gap-2 text-body font-semibold text-primary" href={`tel:${contractor.phone}`}><Phone aria-hidden="true" size={18} />{contractor.phone}</a>}
              {contractor.note && <p className="mt-1 whitespace-pre-line text-caption text-text-muted">{contractor.note}</p>}
            </div>
          </div>
          <div className="flex gap-2">
            <Button disabled={offline || busy} onClick={() => openForm(contractor)} variant="secondary"><Pencil aria-hidden="true" size={18} />แก้ไข</Button>
            {contractor.is_active && <Button disabled={offline || busy} onClick={() => void deactivate(contractor)} variant="danger-outline"><UserRoundX aria-hidden="true" size={18} />ปิดใช้งาน</Button>}
          </div>
        </Card>
      )) : !error && <Card><EmptyState icon={HardHat} title="ยังไม่มีรายชื่อช่าง" description="เพิ่มรายชื่อช่างที่ใช้บ่อย เพื่อเลือกมอบหมายงานได้สะดวก" /></Card>}

      <Modal
        busy={busy}
        footer={<><Button disabled={busy} onClick={() => setOpen(false)} type="button" variant="secondary">ยกเลิก</Button><Button busy={busy} disabled={offline} form="contractor-form" type="submit">บันทึก</Button></>}
        onClose={() => setOpen(false)}
        open={open}
        title={editing ? 'แก้ไขข้อมูลช่าง' : 'เพิ่มช่าง'}
      >
        <form className="grid gap-4" id="contractor-form" onSubmit={submit}>
          <Field label="ชื่อช่าง / ร้าน"><Input maxLength={200} onChange={(event) => setForm({ ...form, name: event.target.value })} required value={form.name} /></Field>
          <Field label="เบอร์โทร"><Input autoComplete="tel" inputMode="tel" onChange={(event) => setForm({ ...form, phone: event.target.value })} type="tel" value={form.phone} /></Field>
          <Field label="ประเภทงาน"><Input onChange={(event) => setForm({ ...form, trade: event.target.value })} value={form.trade} /></Field>
          <Field label="หมายเหตุ"><Textarea onChange={(event) => setForm({ ...form, note: event.target.value })} value={form.note} /></Field>
          <label className="flex min-h-touch items-center gap-3 text-body font-semibold text-text-heading"><input checked={form.is_active} className="size-6 accent-primary-container" onChange={(event) => setForm({ ...form, is_active: event.target.checked })} type="checkbox" />เปิดใช้งาน</label>
          {error && <p className="text-body text-danger">{error}</p>}
        </form>
      </Modal>
    </div>
  )
}
