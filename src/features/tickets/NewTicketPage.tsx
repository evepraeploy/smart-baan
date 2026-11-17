import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from 'react'
import { useNavigate } from 'react-router'
import { Camera, ImagePlus, X } from 'lucide-react'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { Field, Input, Textarea } from '../../components/ui/Field'
import { Select } from '../../components/ui/Select'
import { useOffline } from '../../components/layout/OfflineBanner'
import { useToast } from '../../components/ui/Toast'
import { compressSlipImage, type CompressedSlip } from '../../lib/image'
import { messages } from '../../lib/messages.th'
import { toThaiError } from '../../lib/errors'
import { addTicketPhotos, createTicket, uploadTicketPhoto, type TicketCategory } from './api'
import { ticketCategoryLabels } from './labels'

type PhotoDraft = { id: string; compressed: CompressedSlip; preview: string }
const categoryOrder: TicketCategory[] = ['electric', 'plumbing', 'road', 'cleaning', 'security', 'other']

export function NewTicketPage() {
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

  useEffect(() => () => photoUrls.current.forEach((url) => URL.revokeObjectURL(url)), [])

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
    <div className="grid gap-5">
      <div><h1 className="text-h1 font-bold text-text-heading">แจ้งเรื่องใหม่</h1><p className="text-body text-text-muted">รายละเอียดจะช่วยให้กรรมการแก้ไขได้ตรงจุด</p></div>
      <Card>
        <form className="grid gap-4" noValidate onSubmit={submit}>
          <Field label="หมวดหมู่">
            <Select onChange={(event) => setCategory(event.target.value as TicketCategory)} value={category}>
              {categoryOrder.map((item) => <option key={item} value={item}>{ticketCategoryLabels[item]}</option>)}
            </Select>
          </Field>
          <Field label="หัวข้อ">
            <Input maxLength={200} onChange={(event) => setTitle(event.target.value)} required value={title} />
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
                <img alt="ตัวอย่างรูปประกอบ" className="aspect-square w-full rounded-md border border-border object-cover" src={photo.preview} />
                <p className="mt-1 text-caption text-text-muted">{(photo.compressed.compressedSize / 1024).toFixed(0)} KB</p>
                <Button aria-label="นำรูปออก" className="absolute right-2 top-2 min-h-10 min-w-10 px-2" onClick={() => removePhoto(photo.id)} type="button" variant="danger-outline"><X aria-hidden="true" size={18} /></Button>
              </div>
            ))}
          </div>}
          {error && <p aria-live="polite" className="rounded-md bg-red-50 p-3 text-body text-red-700">{error}</p>}
          {offline && <p className="text-body text-amber-800">{messages.offlineTickets}</p>}
          <div className="flex flex-wrap justify-end gap-2">
            <Button disabled={busy} onClick={() => navigate('/repairs')} type="button" variant="secondary">ยกเลิก</Button>
            <Button busy={busy} disabled={offline || compressing} type="submit">ส่งเรื่อง</Button>
          </div>
        </form>
      </Card>
    </div>
  )
}
