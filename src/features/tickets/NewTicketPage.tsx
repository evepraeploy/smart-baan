import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router'
import { Camera, ImagePlus, X } from 'lucide-react'
import { Button } from '../../components/ui/Button'
import { StickyActionBar } from '../../components/ui/StickyActionBar'
import { Card } from '../../components/ui/Card'
import { Field, Input, Textarea } from '../../components/ui/Field'
import { Select } from '../../components/ui/Select'
import { useOffline } from '../../components/layout/OfflineBanner'
import { useToast } from '../../components/ui/Toast'
import { compressSlipImage, type CompressedSlip } from '../../lib/image'
import { messages } from '../../lib/messages.th'
import { toThaiError } from '../../lib/errors'
import { addTicketPhotos, createTicket, listCommunityTickets, toggleTicketAffected, uploadTicketPhoto, type CommunityTicket, type TicketCategory } from './api'
import { ticketCategoryLabels } from './labels'
import { useAuth } from '../auth/AuthProvider'

type PhotoDraft = { id: string; compressed: CompressedSlip; preview: string }
const categoryOrder: TicketCategory[] = ['electric', 'plumbing', 'road', 'cleaning', 'security', 'other']

export function NewTicketPage() {
  const { house } = useAuth()
  const navigate = useNavigate()
  const { showToast } = useToast()
  const offline = useOffline()
  const cameraRef = useRef<HTMLInputElement>(null)
  const albumRef = useRef<HTMLInputElement>(null)
  const photoUrls = useRef<string[]>([])
  const [category, setCategory] = useState<TicketCategory>('electric')
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [photos, setPhotos] = useState<PhotoDraft[]>([])
  const [compressing, setCompressing] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [suggestions, setSuggestions] = useState<CommunityTicket[]>([])
  const [quickBusy, setQuickBusy] = useState('')

  useEffect(() => () => photoUrls.current.forEach((url) => URL.revokeObjectURL(url)), [])
  useEffect(() => {
    let active = true
    void listCommunityTickets().then((tickets) => {
      if (active) setSuggestions(tickets.filter((ticket) => ticket.category === category && !ticket.is_mine && ['pending', 'in_progress'].includes(ticket.status)).slice(0, 5))
    }).catch(() => {
      if (active) setSuggestions([])
    })
    return () => { active = false }
  }, [category])

  async function quickAffect(ticketId: string) {
    setQuickBusy(ticketId)
    try {
      const result = await toggleTicketAffected(ticketId)
      setSuggestions((current) => current.map((ticket) => ticket.id === ticketId ? { ...ticket, ...result } : ticket))
    } catch (caught) {
      setError(toThaiError(caught))
    } finally {
      setQuickBusy('')
    }
  }

  async function addPhoto(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    if (photos.length >= 3) {
      setError(messages.ticketTooManyPhotos)
      return
    }
    setError('')
    setCompressing(true)
    try {
      const compressed = await compressSlipImage(file)
      const preview = URL.createObjectURL(compressed.file)
      photoUrls.current.push(preview)
      setPhotos((current) => current.length >= 3 ? current : [...current, {
        id: crypto.randomUUID(),
        compressed,
        preview,
      }])
    } catch (caught) {
      setError(toThaiError(caught))
    } finally {
      setCompressing(false)
    }
  }

  function removePhoto(id: string) {
    setPhotos((current) => {
      const photo = current.find((item) => item.id === id)
      if (photo) {
        URL.revokeObjectURL(photo.preview)
        photoUrls.current = photoUrls.current.filter((url) => url !== photo.preview)
      }
      return current.filter((item) => item.id !== id)
    })
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    if (offline) return setError(messages.offlineTickets)
    const trimmedTitle = title.trim()
    const trimmedDescription = description.trim()
    if (!trimmedTitle) return setError(messages.ticketTitleRequired)
    if (!trimmedDescription) return setError(messages.ticketDescriptionRequired)
    setBusy(true)
    try {
      const id = await createTicket({ category, title: trimmedTitle, description: trimmedDescription })
      if (photos.length) {
        try {
          const paths: string[] = []
          for (const photo of photos) paths.push(await uploadTicketPhoto(id, photo.compressed.file, photo.compressed.ext))
          await addTicketPhotos(id, 'report', paths)
        } catch {
          showToast(messages.ticketPhotosUploadFailed, 'error')
          navigate(`/repairs/${id}`, { replace: true })
          return
        }
      }
      showToast(messages.ticketCreated)
      navigate(`/repairs/${id}`, { replace: true })
    } catch (caught) {
      setError(toThaiError(caught))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="mx-auto grid w-full max-w-2xl gap-5">
      <div><h1 className="font-display text-h1 font-bold text-text-heading">แจ้งเรื่องใหม่</h1><p className="text-body text-text-muted">รายละเอียดจะช่วยให้กรรมการแก้ไขได้ตรงจุด</p></div>
      <Card>
        <form className="grid gap-4" noValidate onSubmit={submit}>
          <Field label="หมวดหมู่">
            <Select onChange={(event) => setCategory(event.target.value as TicketCategory)} value={category}>
              {categoryOrder.map((item) => <option key={item} value={item}>{ticketCategoryLabels[item]}</option>)}
            </Select>
          </Field>
          {suggestions.length > 0 && <section className="grid gap-2 rounded-lg bg-surface-low p-4">
            <div>
              <h2 className="font-display text-h3 font-bold text-text-heading">เรื่องที่แจ้งไว้แล้วในหมวดนี้</h2>
              <p className="text-caption text-text-muted">ถ้าเป็นเรื่องเดียวกัน กด “ฉันก็เจอ” แทนการแจ้งซ้ำ</p>
              {!house && <p className="text-caption text-text-muted">บัญชีนี้ยังไม่ได้ผูกกับบ้าน จึงแจ้งว่าเจอปัญหาไม่ได้</p>}
            </div>
            {suggestions.map((ticket) => <div className="flex min-w-0 items-center gap-2 border-t border-outline-soft pt-2" key={ticket.id}>
              <Link className="min-w-0 flex-1" to={`/repairs/${ticket.id}`}>
                <span className="line-clamp-2 block font-semibold text-text-heading">{ticket.title}</span>
                <span className="text-caption text-text-muted">{ticket.affected_count} บ้าน</span>
              </Link>
              <Button busy={quickBusy === ticket.id} disabled={Boolean(quickBusy) || !house} onClick={() => void quickAffect(ticket.id)} type="button" variant={ticket.i_am_affected ? 'secondary' : 'outline'}>
                {ticket.i_am_affected ? 'ยกเลิก' : 'ฉันก็เจอ'}
              </Button>
            </div>)}
          </section>}
          <Field label="หัวข้อ">
            <Input enterKeyHint="next" maxLength={200} onChange={(event) => setTitle(event.target.value)} required value={title} />
          </Field>
          <Field label="รายละเอียด">
            <Textarea maxLength={5000} onChange={(event) => setDescription(event.target.value)} required value={description} />
          </Field>
          <Field hint="แนบได้ไม่เกิน 3 รูป รูปจะถูกย่อให้มีขนาดไม่เกิน 200 KB" label="รูปประกอบ (ไม่บังคับ)">
            <div className="flex flex-wrap gap-2">
              <Button disabled={photos.length >= 3 || compressing || busy} onClick={() => cameraRef.current?.click()} type="button" variant="secondary"><Camera aria-hidden="true" size={20} />ถ่ายรูป</Button>
              <Button disabled={photos.length >= 3 || compressing || busy} onClick={() => albumRef.current?.click()} type="button" variant="secondary"><ImagePlus aria-hidden="true" size={20} />เลือกจากอัลบั้ม</Button>
            </div>
            <input accept="image/*" capture="environment" className="sr-only" onChange={(event) => void addPhoto(event)} ref={cameraRef} type="file" />
            <input accept="image/*" className="sr-only" onChange={(event) => void addPhoto(event)} ref={albumRef} type="file" />
          </Field>
          {compressing && <p aria-live="polite" className="text-body text-text-muted">กำลังย่อรูป…</p>}
          {photos.length > 0 && <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {photos.map((photo) => (
              <div className="relative" key={photo.id}>
                <img alt="ตัวอย่างรูปประกอบ" className="aspect-square w-full rounded-md border border-outline-soft object-cover" src={photo.preview} />
                <p className="mt-1 text-caption text-text-muted">{(photo.compressed.compressedSize / 1024).toFixed(0)} KB</p>
                <Button aria-label="นำรูปออก" className="absolute right-2 top-2 min-h-touch min-w-touch px-2" onClick={() => removePhoto(photo.id)} type="button" variant="danger-outline"><X aria-hidden="true" size={18} /></Button>
              </div>
            ))}
          </div>}
          {error && <p aria-live="polite" className="rounded-md bg-tint-danger p-3 text-body text-danger">{error}</p>}
          {offline && <p className="text-body text-secondary">{messages.offlineTickets}</p>}
          <div className="flex justify-end">
            <Button className="w-full sm:w-auto" disabled={busy} onClick={() => navigate('/repairs')} type="button" variant="secondary">ยกเลิก</Button>
          </div>
          <StickyActionBar>
            <Button busy={busy} className="w-full lg:w-auto" disabled={offline || compressing} type="submit">ส่งเรื่อง</Button>
          </StickyActionBar>
        </form>
      </Card>
    </div>
  )
}
