import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { Megaphone, Pin, Plus, Trash2 } from 'lucide-react'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { EmptyState } from '../../components/ui/EmptyState'
import { Field, Input, Textarea } from '../../components/ui/Field'
import { Modal } from '../../components/ui/Modal'
import { Spinner } from '../../components/ui/Spinner'
import { useToast } from '../../components/ui/Toast'
import { useOffline } from '../../components/layout/OfflineBanner'
import { compressSlipImage } from '../../lib/image'
import { formatDateTH, formatDateTimeTH } from '../../lib/format'
import { toThaiError } from '../../lib/errors'
import { messages } from '../../lib/messages.th'
import { useAuth } from '../auth/AuthProvider'
import {
  deleteAnnouncement,
  listAnnouncements,
  markAnnouncementsRead,
  removeAnnouncementImage,
  saveAnnouncement,
  uploadAnnouncementImage,
  type Announcement,
  type AnnouncementInput,
} from './api'

type AnnouncementForm = {
  title: string
  body: string
  imagePath: string | null
  imageFile: File | null
  isPinned: boolean
  expiresOn: string
}

const emptyForm: AnnouncementForm = {
  title: '',
  body: '',
  imagePath: null,
  imageFile: null,
  isPinned: false,
  expiresOn: '',
}

function formatExpiryInput(value: string | null): string {
  if (!value) return ''
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Bangkok',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date(value))
  const part = (name: string) => parts.find((item) => item.type === name)?.value ?? ''
  return `${part('year')}-${part('month')}-${part('day')}`
}

export function AnnouncementsPage() {
  const { session, roles } = useAuth()
  const { showToast } = useToast()
  const offline = useOffline()
  const committee = roles.includes('committee') || roles.includes('admin')
  const userId = session?.user.id
  const [items, setItems] = useState<Announcement[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<Announcement | null>(null)
  const [form, setForm] = useState<AnnouncementForm>(emptyForm)

  const refresh = useCallback(async () => {
    if (!userId) {
      setItems([])
      setLoading(false)
      return
    }
    setLoading(true)
    try {
      const result = await listAnnouncements(userId)
      setItems(result)
      setError('')
    } catch (caught) {
      setError(toThaiError(caught))
    } finally {
      setLoading(false)
    }
  }, [userId])

  useEffect(() => { void refresh() }, [refresh])

  useEffect(() => {
    const unreadIds = items.filter((item) => !item.is_read).map((item) => item.id)
    if (offline || !userId || !unreadIds.length) return
    void markAnnouncementsRead(unreadIds, userId).then(() => {
      setItems((current) => current.map((item) => unreadIds.includes(item.id) ? { ...item, is_read: true } : item))
    }).catch(() => {})
  }, [items, offline, userId])

  function openCreate() {
    setEditing(null)
    setForm(emptyForm)
    setError('')
    setModalOpen(true)
  }

  function openEdit(item: Announcement) {
    setEditing(item)
    setForm({
      title: item.title,
      body: item.body,
      imagePath: item.image_path,
      imageFile: null,
      isPinned: item.is_pinned,
      expiresOn: formatExpiryInput(item.expires_at),
    })
    setError('')
    setModalOpen(true)
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (offline) return
    setError('')
    const title = form.title.trim()
    const body = form.body.trim()
    if (!title) return setError(messages.announcementTitleRequired)
    if (!body) return setError(messages.announcementBodyRequired)
    setBusy(true)
    let uploadedPath: string | null = null
    try {
      let imagePath = form.imagePath
      if (form.imageFile) {
        const compressed = await compressSlipImage(form.imageFile)
        uploadedPath = await uploadAnnouncementImage(compressed.file, compressed.ext)
        imagePath = uploadedPath
      }
      const input: AnnouncementInput = {
        title,
        body,
        image_path: imagePath,
        is_pinned: form.isPinned,
        expires_at: form.expiresOn ? `${form.expiresOn}T23:59:59+07:00` : null,
      }
      await saveAnnouncement(editing?.id ?? null, input)
      if (editing?.image_path && uploadedPath) await removeAnnouncementImage(editing.image_path).catch(() => {})
      showToast(messages.announcementSaved)
      setModalOpen(false)
      await refresh()
    } catch (caught) {
      if (uploadedPath) await removeAnnouncementImage(uploadedPath).catch(() => {})
      setError(toThaiError(caught))
    } finally {
      setBusy(false)
    }
  }

  async function remove(item: Announcement) {
    if (offline) return
    if (!window.confirm(`ลบประกาศ “${item.title}” ใช่หรือไม่?`)) return
    setBusy(true)
    setError('')
    try {
      await deleteAnnouncement(item.id, item.image_path)
      showToast(messages.announcementDeleted)
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
          <h1 className="font-display text-h1 font-bold text-text-heading">ประกาศ</h1>
          <p className="text-body text-text-muted">ข่าวสารและข้อมูลจากหมู่บ้าน</p>
        </div>
        {committee && <Button disabled={offline} onClick={openCreate}><Plus aria-hidden="true" size={20} />สร้างประกาศ</Button>}
      </div>
      {offline && committee && <p className="text-body text-secondary">{messages.offlineAnnouncements}</p>}
      {error && <p aria-live="polite" className="rounded-md bg-tint-danger p-3 text-body text-danger">{error}</p>}
      {loading ? <Spinner /> : items.length ? items.map((item) => {
        const expired = Boolean(item.expires_at && new Date(item.expires_at).getTime() <= Date.now())
        return (
          <Card className={item.is_pinned ? 'border-outline-soft bg-tint-warning' : ''} key={item.id}>
            <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2">
                {item.is_pinned && <span className="inline-flex min-h-8 items-center gap-1.5 rounded-sm bg-tint-warning px-2.5 py-1 text-caption font-semibold text-secondary"><Pin aria-hidden="true" size={16} />ปักหมุด</span>}
                {!item.is_read && <span className="rounded-full bg-status-success-bg px-3 py-1 text-caption font-semibold text-status-success-fg">ใหม่</span>}
                {committee && expired && <span className="rounded-full bg-status-neutral-bg px-3 py-1 text-caption font-semibold text-status-neutral-fg">หมดอายุแล้ว</span>}
              </div>
              {committee && <div className="flex gap-2">
                <Button className="px-3" disabled={offline || busy} onClick={() => openEdit(item)} variant="secondary">แก้ไข</Button>
                <Button aria-label={`ลบประกาศ ${item.title}`} className="min-w-touch px-3" disabled={offline || busy} onClick={() => void remove(item)} variant="danger-outline"><Trash2 aria-hidden="true" size={20} /></Button>
              </div>}
            </div>
            <h2 className="font-display text-h2 font-bold text-text-heading">{item.title}</h2>
            <p className="mt-1 text-caption text-text-muted">ประกาศเมื่อ {formatDateTimeTH(item.created_at)}{item.expires_at ? ` · หมดอายุ ${formatDateTH(item.expires_at)}` : ''}</p>
            {item.signed_url && <img alt={`รูปประกาศ: ${item.title}`} className="mt-4 max-h-96 w-full rounded-md object-contain" src={item.signed_url} />}
            <p className="mt-4 whitespace-pre-line text-body-lg text-text-body">{item.body}</p>
          </Card>
        )
      }) : !error && <Card><EmptyState description="เมื่อมีข่าวสารใหม่ รายการจะปรากฏที่นี่" icon={Megaphone} title="ยังไม่มีประกาศ" /></Card>}

      <Modal
        busy={busy}
        footer={(
          <>
            <Button disabled={busy} onClick={() => setModalOpen(false)} type="button" variant="secondary">ยกเลิก</Button>
            <Button busy={busy} disabled={offline} form="announcement-form" type="submit">บันทึกประกาศ</Button>
          </>
        )}
        onClose={() => setModalOpen(false)}
        open={modalOpen}
        title={editing ? 'แก้ไขประกาศ' : 'สร้างประกาศ'}
      >
        <form className="grid gap-4" id="announcement-form" noValidate onSubmit={submit}>
          <Field label="หัวข้อ">
            <Input maxLength={200} onChange={(event) => setForm({ ...form, title: event.target.value })} required value={form.title} />
          </Field>
          <Field label="เนื้อหา">
            <Textarea maxLength={5000} onChange={(event) => setForm({ ...form, body: event.target.value })} required value={form.body} />
          </Field>
          <Field hint="รูปจะถูกย่อให้มีขนาดไม่เกิน 200 KB" label="รูปประกาศ (ไม่บังคับ)">
            <Input accept="image/*" onChange={(event) => setForm({ ...form, imageFile: event.target.files?.[0] ?? null })} type="file" />
          </Field>
          {form.imageFile && <p className="text-caption text-text-muted">{form.imageFile.name}</p>}
          <label className="flex min-h-touch items-center gap-3 text-body font-semibold text-text-heading">
            <input checked={form.isPinned} className="size-6 accent-primary-container" onChange={(event) => setForm({ ...form, isPinned: event.target.checked })} type="checkbox" />
            ปักหมุดประกาศ
          </label>
          <Field hint={form.expiresOn ? `แสดงถึง ${formatDateTH(form.expiresOn)}` : undefined} label="วันหมดอายุ (ไม่บังคับ)">
            <Input onChange={(event) => setForm({ ...form, expiresOn: event.target.value })} type="date" value={form.expiresOn} />
          </Field>
          {error && <p aria-live="polite" className="text-body text-danger">{error}</p>}
          {offline && <p className="text-body text-secondary">{messages.offlineAnnouncements}</p>}
        </form>
      </Modal>
    </div>
  )
}
