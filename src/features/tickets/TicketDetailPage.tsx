import { useCallback, useEffect, useRef, useState, type ChangeEvent, type FormEvent } from 'react'
import { Link, useLocation, useParams } from 'react-router'
import { Camera, ImagePlus, Plus, Receipt, Send, X } from 'lucide-react'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { Field, Input, Textarea } from '../../components/ui/Field'
import { Modal } from '../../components/ui/Modal'
import { Select } from '../../components/ui/Select'
import { Spinner } from '../../components/ui/Spinner'
import { useOffline } from '../../components/layout/OfflineBanner'
import { useToast } from '../../components/ui/Toast'
import { compressSlipImage, type CompressedSlip } from '../../lib/image'
import { formatBaht, formatDateTimeInputTH, formatDateTimeTH, parseDateTimeInputTH } from '../../lib/format'
import { messages } from '../../lib/messages.th'
import { toThaiError } from '../../lib/errors'
import { useAuth } from '../auth/AuthProvider'
import {
  addTicketComment,
  addTicketPhotos,
  assignTicket,
  getTicket,
  linkTicketAsset,
  listCommitteeMembers,
  listContractors,
  saveContractor,
  updateTicketStatus,
  uploadTicketPhoto,
  type CommitteeMember,
  type Contractor,
  type TicketDetails,
  type TicketEvent,
  type TicketStatus,
} from './api'
import { listAssets, type Asset } from '../assets/api'
import { ticketCategoryLabels, ticketStatusLabels } from './labels'
import { TicketStatusBadge } from './TicketListPage'

type PhotoDraft = { id: string; compressed: CompressedSlip; preview: string }
const nextStatuses: Record<TicketStatus, TicketStatus[]> = {
  pending: ['in_progress', 'rejected'],
  in_progress: ['done', 'rejected'],
  done: [],
  rejected: [],
}

export function TicketDetailPage() {
  const { id = '' } = useParams()
  const location = useLocation()
  const { session, roles } = useAuth()
  const { showToast } = useToast()
  const offline = useOffline()
  const committee = roles.includes('committee') || roles.includes('admin')
  const managementMode = committee && location.pathname.startsWith('/maintenance/')
  const userId = session?.user.id
  const [details, setDetails] = useState<TicketDetails | null>(null)
  const [members, setMembers] = useState<CommitteeMember[]>([])
  const [contractors, setContractors] = useState<Contractor[]>([])
  const [assets, setAssets] = useState<Asset[]>([])
  const [linkedAssetId, setLinkedAssetId] = useState('')
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [comment, setComment] = useState('')
  const [assigneeId, setAssigneeId] = useState('')
  const [contractorId, setContractorId] = useState('')
  const [appointmentAt, setAppointmentAt] = useState('')
  const [fee, setFee] = useState('')
  const [statusModal, setStatusModal] = useState<'reject' | 'done' | null>(null)
  const [statusComment, setStatusComment] = useState('')
  const [recordExpense, setRecordExpense] = useState(false)
  const [afterPhotos, setAfterPhotos] = useState<PhotoDraft[]>([])
  const [contractorModal, setContractorModal] = useState(false)
  const [contractorForm, setContractorForm] = useState({ name: '', phone: '', trade: '', note: '' })
  const afterPhotoUrls = useRef<string[]>([])

  const refresh = useCallback(async () => {
    if (!id || !userId) {
      setLoading(false)
      return
    }
    setLoading(true)
    try {
      const result = await getTicket(id, userId, committee)
      setDetails(result)
      setLinkedAssetId(result.linkedAsset?.id ?? '')
      setAssigneeId(result.ticket.assignee_id ?? '')
      setContractorId(result.job?.contractor_id ?? '')
      setAppointmentAt(result.job?.appointment_at ? formatDateTimeInputTH(new Date(result.job.appointment_at)) : '')
      setFee(result.job?.fee == null ? '' : String(result.job.fee))
      setError('')
      if (managementMode) {
        const [memberRows, contractorRows, assetRows] = await Promise.all([listCommitteeMembers(), listContractors(true), listAssets()])
        setMembers(memberRows)
        setContractors(contractorRows)
        setAssets(assetRows)
      }
    } catch (caught) {
      setError(toThaiError(caught))
    } finally {
      setLoading(false)
    }
  }, [committee, id, managementMode, userId])
  useEffect(() => { void refresh() }, [refresh])
  useEffect(() => () => afterPhotoUrls.current.forEach((url) => URL.revokeObjectURL(url)), [])

  async function sendComment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (offline) return setError(messages.offlineTickets)
    if (!comment.trim()) return setError(messages.ticketCommentRequired)
    setBusy(true)
    try {
      await addTicketComment(id, comment.trim())
      setComment('')
      await refresh()
    } catch (caught) {
      setError(toThaiError(caught))
    } finally {
      setBusy(false)
    }
  }

  async function saveAssignment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (offline) return setError(messages.offlineTickets)
    setBusy(true)
    try {
      await assignTicket({
        id,
        assigneeId: assigneeId || null,
        contractorId: contractorId || null,
        appointmentAt: appointmentAt ? parseDateTimeInputTH(appointmentAt).toISOString() : null,
        fee: fee === '' ? null : Number(fee),
      })
      showToast(messages.ticketAssigned)
      await refresh()
    } catch (caught) {
      setError(toThaiError(caught))
    } finally {
      setBusy(false)
    }
  }

  async function captureAfterPhoto(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    setError('')
    try {
      const compressed = await compressSlipImage(file)
      const preview = URL.createObjectURL(compressed.file)
      afterPhotoUrls.current.push(preview)
      setAfterPhotos((current) => [...current, { id: crypto.randomUUID(), compressed, preview }])
    } catch (caught) {
      setError(toThaiError(caught))
    }
  }

  async function changeStatus(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!details || offline || !statusModal) return setError(messages.offlineTickets)
    const targetStatus = statusModal === 'reject' ? 'rejected' : 'done'
    if (targetStatus === 'rejected' && statusComment.trim().length < 3) return setError(messages.ticketReasonRequired)
    setBusy(true)
    setError('')
    try {
      if (statusModal === 'done' && afterPhotos.length) {
        const paths: string[] = []
        for (const photo of afterPhotos) paths.push(await uploadTicketPhoto(id, photo.compressed.file, photo.compressed.ext))
        await addTicketPhotos(id, 'after', paths)
      }
      await updateTicketStatus(id, targetStatus, statusComment.trim() || null, statusModal === 'done' && recordExpense)
      showToast(messages.ticketStatusUpdated)
      setStatusModal(null)
      setStatusComment('')
      afterPhotoUrls.current.forEach((url) => URL.revokeObjectURL(url))
      afterPhotoUrls.current = []
      setAfterPhotos([])
      await refresh()
    } catch (caught) {
      setError(toThaiError(caught))
    } finally {
      setBusy(false)
    }
  }

  async function addContractor(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (offline) return setError(messages.offlineTickets)
    if (!contractorForm.name.trim()) return setError(messages.contractorNameRequired)
    setBusy(true)
    try {
      const newId = await saveContractor(null, {
        name: contractorForm.name.trim(),
        phone: contractorForm.phone.trim() || null,
        trade: contractorForm.trade.trim() || null,
        note: contractorForm.note.trim() || null,
        is_active: true,
      })
      const rows = await listContractors(true)
      setContractors(rows)
      if (newId) setContractorId(newId)
      setContractorModal(false)
      setContractorForm({ name: '', phone: '', trade: '', note: '' })
      showToast(messages.contractorSaved)
    } catch (caught) {
      setError(toThaiError(caught))
    } finally {
      setBusy(false)
    }
  }

  async function changeLinkedAsset(assetId: string) {
    if (offline) return setError(messages.offlineAssets)
    setBusy(true)
    try {
      await linkTicketAsset(id, assetId || null)
      setLinkedAssetId(assetId)
      showToast(messages.assetLinkSaved)
      await refresh()
    } catch (caught) {
      setError(toThaiError(caught))
    } finally {
      setBusy(false)
    }
  }

  if (loading) return <Spinner />
  if (!details) return <p aria-live="polite" className="rounded-md bg-red-50 p-3 text-body text-red-700">{error || messages.ticketNotFound}</p>
  const { ticket, photos, events, job } = details
  return (
    <div className="grid gap-5">
      <Card>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-caption text-text-muted">{ticket.house_no ? `บ้านเลขที่ ${ticket.house_no} · ` : ''}{ticketCategoryLabels[ticket.category]}</p>
            <h1 className="mt-1 text-h1 font-bold text-text-heading">{ticket.title}</h1>
          </div>
          <TicketStatusBadge status={ticket.status} />
        </div>
        <p className="mt-2 text-caption text-text-muted">แจ้งเมื่อ {formatDateTimeTH(ticket.created_at)}</p>
        <p className="mt-4 whitespace-pre-line text-body-lg text-text-body">{ticket.description}</p>
        {ticket.contractor_name && <p className="mt-3 text-body font-semibold text-text-heading">ผู้รับงาน: {ticket.contractor_name}</p>}
        {error && <p aria-live="polite" className="mt-4 rounded-md bg-red-50 p-3 text-body text-red-700">{error}</p>}
      </Card>

      {photos.length > 0 && (
        <Card>
          <h2 className="mb-3 text-h2 font-bold text-text-heading">รูปประกอบเรื่องและหลังซ่อม</h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {photos.map((photo) => (
              <a className="grid gap-1" href={photo.signed_url} key={photo.id} rel="noreferrer" target="_blank">
                {photo.signed_url && <img alt={photo.kind === 'report' ? 'รูปประกอบเรื่อง' : 'รูปหลังซ่อม'} className="aspect-square w-full rounded-md border border-border object-cover" src={photo.signed_url} />}
                <span className="text-caption font-semibold text-text-muted">{photo.kind === 'report' ? 'รูปประกอบเรื่อง' : 'รูปหลังซ่อม'}</span>
              </a>
            ))}
          </div>
        </Card>
      )}

      {managementMode && (
        <Card>
          <h2 className="mb-4 text-h2 font-bold text-text-heading">ผู้รับผิดชอบและนัดหมาย</h2>
          <form className="grid gap-4" onSubmit={saveAssignment}>
            <Field label="กรรมการผู้รับผิดชอบ">
              <Select onChange={(event) => setAssigneeId(event.target.value)} value={assigneeId}>
                <option value="">ยังไม่กำหนด</option>
                {members.map((member) => <option key={member.id} value={member.id}>{member.display_name}</option>)}
              </Select>
            </Field>
            <Field label="ช่าง / ผู้รับงาน">
              <Select onChange={(event) => setContractorId(event.target.value)} value={contractorId}>
                <option value="">ยังไม่กำหนด</option>
                {contractors.map((contractor) => <option key={contractor.id} value={contractor.id}>{contractor.name}</option>)}
              </Select>
            <Button className="mt-2" disabled={offline || busy || ticket.status === 'done' || ticket.status === 'rejected'} onClick={() => setContractorModal(true)} type="button" variant="secondary"><Plus aria-hidden="true" size={18} />เพิ่มช่างใหม่</Button>
            </Field>
            <Field hint={appointmentAt ? formatDateTimeTH(parseDateTimeInputTH(appointmentAt)) : 'วันที่และเวลา พ.ศ. เขตเวลาไทย'} label="วันนัดหมาย (ไม่บังคับ)">
              <Input onChange={(event) => setAppointmentAt(event.target.value)} type="datetime-local" value={appointmentAt} />
            </Field>
            <Field label="ค่าจ้าง (บาท, ไม่บังคับ)">
              <Input min="0" onChange={(event) => setFee(event.target.value)} step="0.01" type="number" value={fee} />
            </Field>
            <Button busy={busy} disabled={offline || ticket.status === 'done' || ticket.status === 'rejected'} type="submit">บันทึกการมอบหมาย</Button>
          </form>
          {job?.contractor?.phone && <a className="mt-3 inline-flex min-h-touch items-center text-body font-semibold text-primary-700" href={`tel:${job.contractor.phone}`}>โทร {job.contractor.phone}</a>}
          {job?.fee != null && <p className="mt-2 text-body text-text-muted">ค่าจ้าง: {formatBaht(job.fee)}</p>}
          {job?.ledger_entry_id && <p className="mt-3 inline-flex items-center gap-2 rounded-full bg-status-success-bg px-3 py-2 text-caption font-semibold text-status-success-fg"><Receipt aria-hidden="true" size={16} />บันทึกเป็นรายจ่ายแล้ว</p>}
        </Card>
      )}

      {managementMode && (
        <Card>
          <h2 className="mb-3 text-h2 font-bold text-text-heading">อุปกรณ์ที่เกี่ยวข้อง</h2>
          <Field label="เลือกอุปกรณ์ส่วนกลาง">
            <Select disabled={offline || busy} onChange={(event) => void changeLinkedAsset(event.target.value)} value={linkedAssetId}>
              <option value="">ไม่เชื่อมกับอุปกรณ์</option>
              {assets.filter((asset) => asset.status === 'active' || asset.id === linkedAssetId).map((asset) => <option key={asset.id} value={asset.id}>{asset.name}{asset.status === 'active' ? '' : ' (ไม่พร้อมใช้งาน)'}</option>)}
              {details.linkedAsset && !assets.some((asset) => asset.id === details.linkedAsset?.id) && <option value={details.linkedAsset.id}>{details.linkedAsset.name} (ไม่พบในทะเบียน)</option>}
            </Select>
          </Field>
          {details.linkedAsset && <Link className="mt-2 inline-flex min-h-touch items-center text-body font-semibold text-primary-700" to={`/assets/${details.linkedAsset.id}`}>{details.linkedAsset.name}</Link>}
        </Card>
      )}

      {managementMode && nextStatuses[ticket.status].length > 0 && (
        <Card>
          <h2 className="mb-3 text-h2 font-bold text-text-heading">ดำเนินการ</h2>
          <div className="flex flex-wrap gap-2">
            {ticket.status === 'pending' && <Button disabled={offline || busy} onClick={async () => {
              setBusy(true)
              try { await updateTicketStatus(id, 'in_progress', null); showToast(messages.ticketStatusUpdated); await refresh() }
              catch (caught) { setError(toThaiError(caught)) } finally { setBusy(false) }
            }} type="button">รับเรื่อง</Button>}
            {ticket.status === 'in_progress' && <Button disabled={offline || busy} onClick={() => { setStatusModal('done'); setRecordExpense(Number(fee) > 0); setStatusComment(''); setError('') }} type="button">ปิดงาน</Button>}
            <Button disabled={offline || busy} onClick={() => { setStatusModal('reject'); setStatusComment(''); setError('') }} type="button" variant="danger-outline">ไม่รับเรื่อง</Button>
          </div>
        </Card>
      )}

      <Card>
        <h2 className="mb-4 text-h2 font-bold text-text-heading">ความคืบหน้า</h2>
        <ol className="grid gap-4">
          {events.map((event) => (
            <li className="flex gap-3 border-l-2 border-primary-200 pl-4" key={event.id}>
              <span className="min-w-0 flex-1">
                <span className="block text-body font-semibold text-text-heading">{event.comment || eventLabel(event.event_type)}</span>
                <span className="block text-caption text-text-muted">{event.actor_name} · {formatDateTimeTH(event.created_at)}</span>
                {event.from_status && event.to_status && <span className="block text-caption text-text-muted">{ticketStatusLabels[event.from_status]} → {ticketStatusLabels[event.to_status]}</span>}
              </span>
            </li>
          ))}
        </ol>
        <form className="mt-5 grid gap-3 sm:grid-cols-[1fr_auto]" onSubmit={sendComment}>
          <Field label="เขียนความเห็น">
            <Input maxLength={1000} onChange={(event) => setComment(event.target.value)} value={comment} />
          </Field>
          <Button busy={busy} disabled={offline} type="submit"><Send aria-hidden="true" size={18} />ส่งความเห็น</Button>
        </form>
      </Card>

      <Modal
        busy={busy}
        footer={(
          <>
            <Button disabled={busy} onClick={() => setStatusModal(null)} type="button" variant="secondary">ยกเลิก</Button>
            <Button busy={busy} disabled={offline} form="ticket-status-form" type="submit">{statusModal === 'reject' ? 'ไม่รับเรื่อง' : 'ปิดงาน'}</Button>
          </>
        )}
        onClose={() => setStatusModal(null)}
        open={statusModal !== null}
        title={statusModal === 'reject' ? 'ไม่รับเรื่องนี้' : 'ปิดงานซ่อม'}
      >
        <form className="grid gap-4" id="ticket-status-form" onSubmit={changeStatus}>
          {statusModal === 'reject' ? (
            <Field label="เหตุผล (อย่างน้อย 3 ตัวอักษร)">
              <Textarea maxLength={1000} onChange={(event) => setStatusComment(event.target.value)} required value={statusComment} />
            </Field>
          ) : (
            <>
              <Field label="ความเห็นก่อนปิดงาน (ไม่บังคับ)">
                <Textarea maxLength={1000} onChange={(event) => setStatusComment(event.target.value)} value={statusComment} />
              </Field>
              <Field label="รูปหลังซ่อม (ไม่บังคับ)">
                <div className="flex flex-wrap gap-2">
                  <label className="inline-flex min-h-control cursor-pointer items-center gap-2 rounded-md border border-primary-700 px-4 font-semibold text-primary-700"><Camera aria-hidden="true" size={18} />ถ่ายรูป<input accept="image/*" capture="environment" className="sr-only" onChange={(event) => void captureAfterPhoto(event)} type="file" /></label>
                  <label className="inline-flex min-h-control cursor-pointer items-center gap-2 rounded-md border border-primary-700 px-4 font-semibold text-primary-700"><ImagePlus aria-hidden="true" size={18} />เลือกจากอัลบั้ม<input accept="image/*" className="sr-only" onChange={(event) => void captureAfterPhoto(event)} type="file" /></label>
                </div>
              </Field>
              {afterPhotos.map((photo) => <div className="flex items-center gap-3" key={photo.id}><img alt="ตัวอย่างรูปหลังซ่อม" className="size-16 rounded object-cover" src={photo.preview} /><Button aria-label="นำรูปออก" className="min-w-10 px-2" onClick={() => {
                URL.revokeObjectURL(photo.preview)
                afterPhotoUrls.current = afterPhotoUrls.current.filter((url) => url !== photo.preview)
                setAfterPhotos((current) => current.filter((item) => item.id !== photo.id))
              }} type="button" variant="danger-outline"><X size={18} /></Button></div>)}
              <label className="flex min-h-touch items-center gap-3 text-body font-semibold text-text-heading">
                <input checked={recordExpense} className="size-6 accent-primary-700" onChange={(event) => setRecordExpense(event.target.checked)} type="checkbox" />
                บันทึกค่าจ้างเป็นรายจ่าย
              </label>
              {error && <p aria-live="polite" className="text-body text-red-700">{error}</p>}
            </>
          )}
        </form>
      </Modal>

      <Modal
        busy={busy}
        footer={(
          <>
            <Button disabled={busy} onClick={() => setContractorModal(false)} type="button" variant="secondary">ยกเลิก</Button>
            <Button busy={busy} disabled={offline} form="contractor-inline-form" type="submit">บันทึกช่าง</Button>
          </>
        )}
        onClose={() => setContractorModal(false)}
        open={contractorModal}
        title="เพิ่มช่างใหม่"
      >
        <form className="grid gap-4" id="contractor-inline-form" onSubmit={addContractor}>
          <Field label="ชื่อช่าง / ร้าน"><Input maxLength={200} onChange={(event) => setContractorForm({ ...contractorForm, name: event.target.value })} required value={contractorForm.name} /></Field>
          <Field label="เบอร์โทร"><Input onChange={(event) => setContractorForm({ ...contractorForm, phone: event.target.value })} type="tel" value={contractorForm.phone} /></Field>
          <Field label="ประเภทงาน"><Input onChange={(event) => setContractorForm({ ...contractorForm, trade: event.target.value })} value={contractorForm.trade} /></Field>
          <Field label="หมายเหตุ"><Textarea onChange={(event) => setContractorForm({ ...contractorForm, note: event.target.value })} value={contractorForm.note} /></Field>
        </form>
      </Modal>
    </div>
  )
}

function eventLabel(type: TicketEvent['event_type']): string {
  return {
    created: 'แจ้งเรื่องแล้ว',
    status: 'เปลี่ยนสถานะ',
    assigned: 'มอบหมายงานแล้ว',
    comment: 'ความเห็น',
    photo: 'แนบรูป',
    expense: 'บันทึกค่าใช้จ่ายแล้ว',
  }[type]
}
