import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { Link, useParams } from 'react-router'
import { ArrowLeft, ClipboardList, Pencil, Plus, Receipt } from 'lucide-react'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { Field, Input, Textarea } from '../../components/ui/Field'
import { Modal } from '../../components/ui/Modal'
import { Select } from '../../components/ui/Select'
import { Spinner } from '../../components/ui/Spinner'
import { useOffline } from '../../components/layout/OfflineBanner'
import { useToast } from '../../components/ui/Toast'
import { formatBaht, formatDateTH } from '../../lib/format'
import { messages } from '../../lib/messages.th'
import { toThaiError } from '../../lib/errors'
import { listContractors } from '../tickets/api'
import { getAsset, listTicketsForAsset, recordMaintenance, type MaintenanceKind, type MaintenanceLog } from './api'
import { AssetEditorModal } from './AssetEditorModal'
import { AssetStatusBadge, PmBadge } from './AssetsPage'

function todayBangkok() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Bangkok', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date())
}

export function AssetDetailPage() {
  const { id = '' } = useParams()
  const offline = useOffline()
  const { showToast } = useToast()
  const [assetData, setAssetData] = useState<Awaited<ReturnType<typeof getAsset>> | null>(null)
  const [contractors, setContractors] = useState<{ id: string; name: string }[]>([])
  const [linkedTickets, setLinkedTickets] = useState<{ id: string; title: string; status: string }[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [editorOpen, setEditorOpen] = useState(false)
  const [maintenanceOpen, setMaintenanceOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [performedOn, setPerformedOn] = useState(todayBangkok())
  const [kind, setKind] = useState<MaintenanceKind>('pm')
  const [description, setDescription] = useState('')
  const [contractorId, setContractorId] = useState('')
  const [cost, setCost] = useState('')
  const [recordExpense, setRecordExpense] = useState(false)
  const [ticketId, setTicketId] = useState('')

  const refresh = useCallback(async () => {
    if (!id) return
    setLoading(true)
    try {
      const [data, contractorRows, ticketRows] = await Promise.all([
        getAsset(id),
        listContractors(true),
        listTicketsForAsset(id),
      ])
      setAssetData(data)
      setContractors(contractorRows.map(({ id: contractorId, name }) => ({ id: contractorId, name })))
      setLinkedTickets(ticketRows)
      setError('')
    } catch (caught) {
      setError(toThaiError(caught))
    } finally {
      setLoading(false)
    }
  }, [id])
  useEffect(() => { void refresh() }, [refresh])

  async function submitMaintenance(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (offline) return setError(messages.offlineAssets)
    if (!description.trim()) return setError(messages.maintenanceDescriptionRequired)
    setBusy(true)
    try {
      await recordMaintenance({
        asset_id: id,
        performed_on: performedOn,
        kind,
        description: description.trim(),
        contractor_id: contractorId || null,
        cost: cost === '' ? null : Number(cost),
        record_expense: recordExpense,
        ticket_id: ticketId || null,
      })
      showToast(messages.maintenanceSaved)
      setMaintenanceOpen(false)
      setDescription('')
      setCost('')
      setRecordExpense(false)
      setTicketId('')
      await refresh()
    } catch (caught) {
      setError(toThaiError(caught))
    } finally {
      setBusy(false)
    }
  }

  if (loading) return <Spinner />
  if (!assetData) return <p aria-live="polite" className="rounded-md bg-red-50 p-3 text-body text-red-700">{error || messages.assetNotFound}</p>
  const { asset, logs } = assetData

  return (
    <div className="grid gap-5">
      <Link className="inline-flex min-h-touch items-center gap-2 font-semibold text-primary-700" to="/assets"><ArrowLeft aria-hidden="true" size={18} />กลับทะเบียนอุปกรณ์</Link>
      <Card>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex min-w-0 gap-4">
            {asset.signed_url && <img alt={`รูป${asset.name}`} className="size-24 rounded-md object-cover sm:size-32" src={asset.signed_url} />}
            <div>
              <p className="text-caption text-text-muted">{asset.category ?? 'ไม่ระบุประเภท'}{asset.location ? ` · ${asset.location}` : ''}</p>
              <h1 className="text-h1 font-bold text-text-heading">{asset.name}</h1>
              <AssetStatusBadge status={asset.status} />
              <p className="text-body text-text-muted">{asset.pm_interval_days ? `รอบ PM ทุก ${asset.pm_interval_days} วัน` : 'ไม่มีรอบ PM'}</p>
            </div>
          </div>
          <Button disabled={offline} onClick={() => setEditorOpen(true)} variant="secondary"><Pencil aria-hidden="true" size={18} />แก้ไขอุปกรณ์</Button>
        </div>
        <div className="mt-4"><PmBadge nextDueDate={asset.next_due_date} /></div>
              <p className="mt-3 text-body text-text-muted">ติดตั้งเมื่อ {asset.installed_on ? formatDateTH(asset.installed_on) : 'ไม่ระบุ'}</p>
        {asset.last_maintained_on && <p className="text-body text-text-muted">บำรุงรักษาล่าสุด {formatDateTH(asset.last_maintained_on)}</p>}
        {asset.note && <p className="mt-3 whitespace-pre-line text-body text-text-body">{asset.note}</p>}
      </Card>

      <div className="flex flex-wrap items-end justify-between gap-3">
        <div><h2 className="text-h2 font-bold text-text-heading">ประวัติการบำรุงรักษา</h2><p className="text-body text-text-muted">รายการซ่อมและ PM ของอุปกรณ์นี้</p></div>
        <Button disabled={offline || asset.status === 'retired'} onClick={() => {
          setPerformedOn(todayBangkok())
          setKind('pm')
          setDescription('')
          setContractorId('')
          setCost('')
          setRecordExpense(false)
          setTicketId('')
          setMaintenanceOpen(true)
          setError('')
        }}><Plus aria-hidden="true" size={18} />บันทึกการบำรุงรักษา</Button>
      </div>
      {error && <p aria-live="polite" className="rounded-md bg-red-50 p-3 text-body text-red-700">{error}</p>}
      {logs.length ? logs.map((log) => <MaintenanceLogCard key={log.id} log={log} />) : <Card><p className="text-body text-text-muted">ยังไม่มีประวัติการบำรุงรักษา</p></Card>}

      <AssetEditorModal asset={asset} onClose={() => setEditorOpen(false)} onSaved={() => void refresh()} open={editorOpen} />
      <Modal
        busy={busy}
        footer={<><Button disabled={busy} onClick={() => setMaintenanceOpen(false)} type="button" variant="secondary">ยกเลิก</Button><Button busy={busy} disabled={offline} form="maintenance-form" type="submit">บันทึกประวัติ</Button></>}
        onClose={() => setMaintenanceOpen(false)}
        open={maintenanceOpen}
        title="บันทึกการบำรุงรักษา"
      >
        <form className="grid max-h-[70dvh] gap-4 overflow-y-auto pr-1" id="maintenance-form" onSubmit={submitMaintenance}>
          <Field hint={performedOn ? formatDateTH(performedOn) : 'วันที่ตาม พ.ศ.'} label="วันที่บำรุงรักษา">
            <Input max={todayBangkok()} onChange={(event) => setPerformedOn(event.target.value)} required type="date" value={performedOn} />
          </Field>
          <Field label="ประเภท">
            <Select onChange={(event) => setKind(event.target.value as MaintenanceKind)} value={kind}><option value="pm">PM / บำรุงรักษาตามรอบ</option><option value="repair">ซ่อม</option></Select>
          </Field>
          <Field label="รายละเอียด"><Textarea maxLength={2000} onChange={(event) => setDescription(event.target.value)} required value={description} /></Field>
          <Field label="ช่าง / ผู้รับเหมา">
            <Select onChange={(event) => setContractorId(event.target.value)} value={contractorId}><option value="">ไม่ระบุ</option>{contractors.map((contractor) => <option key={contractor.id} value={contractor.id}>{contractor.name}</option>)}</Select>
          </Field>
          <Field label="ค่าใช้จ่าย (บาท)"><Input min="0" onChange={(event) => { setCost(event.target.value); setRecordExpense(Number(event.target.value) > 0) }} step="0.01" type="number" value={cost} /></Field>
          <label className="flex min-h-touch items-center gap-3 text-body font-semibold text-text-heading"><input checked={recordExpense} className="size-6 accent-primary-700" onChange={(event) => setRecordExpense(event.target.checked)} type="checkbox" />บันทึกเป็นรายจ่าย</label>
          <Field label="เชื่อมกับเรื่องแจ้งซ่อม (ไม่บังคับ)">
            <Select onChange={(event) => setTicketId(event.target.value)} value={ticketId}><option value="">ไม่เชื่อมเรื่อง</option>{linkedTickets.map((ticket) => <option key={ticket.id} value={ticket.id}>{ticket.title}</option>)}</Select>
          </Field>
          {error && <p aria-live="polite" className="text-body text-red-700">{error}</p>}
        </form>
      </Modal>
    </div>
  )
}

function MaintenanceLogCard({ log }: { log: MaintenanceLog }) {
  return (
    <Card>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <span className={`rounded-full px-3 py-1 text-caption font-semibold ${log.kind === 'pm' ? 'bg-status-warning-bg text-status-warning-fg' : 'bg-status-neutral-bg text-status-neutral-fg'}`}>{log.kind === 'pm' ? 'PM' : 'ซ่อม'}</span>
          <p className="mt-2 text-caption text-text-muted">{formatDateTH(log.performed_on)}{log.contractor_name ? ` · ${log.contractor_name}` : ''}</p>
          <p className="mt-1 whitespace-pre-line text-body text-text-heading">{log.description}</p>
          {log.ticket_id && <Link className="mt-2 inline-flex min-h-touch items-center gap-2 text-body font-semibold text-primary-700" to={`/maintenance/${log.ticket_id}`}><ClipboardList aria-hidden="true" size={18} />{log.ticket_title || 'ดูเรื่องแจ้งซ่อม'}</Link>}
        </div>
        <div className="grid justify-items-end gap-2">
          {log.cost != null && <span className="font-semibold text-text-heading">{formatBaht(log.cost)}</span>}
          {log.ledger_entry_id && <span className="inline-flex items-center gap-1 rounded-full bg-status-success-bg px-3 py-1 text-caption font-semibold text-status-success-fg"><Receipt aria-hidden="true" size={15} />บันทึกเป็นรายจ่ายแล้ว</span>}
        </div>
      </div>
    </Card>
  )
}
