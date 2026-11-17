import { useEffect, useState, type FormEvent } from 'react'
import { Button } from '../../components/ui/Button'
import { Field, Input, Textarea } from '../../components/ui/Field'
import { Modal } from '../../components/ui/Modal'
import { Select } from '../../components/ui/Select'
import { useOffline } from '../../components/layout/OfflineBanner'
import { useToast } from '../../components/ui/Toast'
import { compressSlipImage } from '../../lib/image'
import { formatDateTH } from '../../lib/format'
import { messages } from '../../lib/messages.th'
import { toThaiError } from '../../lib/errors'
import { saveAsset, uploadAssetImage, type Asset, type AssetStatus } from './api'

export function AssetEditorModal({ asset, open, onClose, onSaved }: {
  asset: Asset | null
  open: boolean
  onClose: () => void
  onSaved: () => void
}) {
  const offline = useOffline()
  const { showToast } = useToast()
  const [name, setName] = useState('')
  const [category, setCategory] = useState('')
  const [location, setLocation] = useState('')
  const [installedOn, setInstalledOn] = useState('')
  const [interval, setInterval] = useState('')
  const [status, setStatus] = useState<AssetStatus>('active')
  const [note, setNote] = useState('')
  const [imagePath, setImagePath] = useState<string | null>(null)
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    setName(asset?.name ?? '')
    setCategory(asset?.category ?? '')
    setLocation(asset?.location ?? '')
    setInstalledOn(asset?.installed_on ?? '')
    setInterval(asset?.pm_interval_days == null ? '' : String(asset.pm_interval_days))
    setStatus(asset?.status ?? 'active')
    setNote(asset?.note ?? '')
    setImagePath(asset?.image_path ?? null)
    setImageFile(null)
    setError('')
  }, [asset, open])

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (offline) return setError(messages.offlineAssets)
    if (!name.trim()) return setError(messages.assetNameRequired)
    setBusy(true)
    try {
      let finalImagePath = imagePath
      if (imageFile) {
        const compressed = await compressSlipImage(imageFile)
        finalImagePath = await uploadAssetImage(compressed.file, compressed.ext)
      }
      await saveAsset(asset?.id ?? null, {
        name: name.trim(),
        category: category.trim() || null,
        location: location.trim() || null,
        installed_on: installedOn || null,
        image_path: finalImagePath,
        status,
        pm_interval_days: interval ? Number(interval) : null,
        last_maintained_on: asset?.last_maintained_on ?? null,
        next_due_date: asset?.next_due_date ?? null,
        note: note.trim() || null,
      })
      showToast(messages.assetSaved)
      onClose()
      onSaved()
    } catch (caught) {
      setError(toThaiError(caught))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal
      busy={busy}
      footer={<><Button disabled={busy} onClick={onClose} type="button" variant="secondary">ยกเลิก</Button><Button busy={busy} disabled={offline} form="asset-editor-form" type="submit">บันทึกอุปกรณ์</Button></>}
      onClose={onClose}
      open={open}
      title={asset ? 'แก้ไขอุปกรณ์' : 'เพิ่มอุปกรณ์'}
    >
      <form className="grid max-h-[70dvh] gap-4 overflow-y-auto pr-1" id="asset-editor-form" onSubmit={submit}>
        <Field label="ชื่ออุปกรณ์"><Input maxLength={200} onChange={(event) => setName(event.target.value)} required value={name} /></Field>
        <Field label="ประเภท"><Input onChange={(event) => setCategory(event.target.value)} value={category} /></Field>
        <Field label="ตำแหน่ง"><Input onChange={(event) => setLocation(event.target.value)} value={location} /></Field>
        <Field hint={installedOn ? formatDateTH(installedOn) : 'วันที่ตาม พ.ศ.'} label="วันที่ติดตั้ง">
          <Input onChange={(event) => setInstalledOn(event.target.value)} type="date" value={installedOn} />
        </Field>
        <Field hint="กำหนดรอบตั้งแต่ 1 ถึง 3,650 วัน" label="รอบ PM (วัน)">
          <Input max="3650" min="1" onChange={(event) => setInterval(event.target.value)} type="number" value={interval} />
        </Field>
        <Field label="สถานะ">
          <Select onChange={(event) => setStatus(event.target.value as AssetStatus)} value={status}>
            <option value="active">ใช้งาน</option><option value="repair">ซ่อม</option><option value="retired">เลิกใช้</option>
          </Select>
        </Field>
        <Field label="รูปอุปกรณ์">
          <Input accept="image/*" onChange={(event) => setImageFile(event.target.files?.[0] ?? null)} type="file" />
          {imagePath && !imageFile && <span className="text-caption text-text-muted">มีรูปที่บันทึกไว้แล้ว</span>}
        </Field>
        <Field label="หมายเหตุ"><Textarea maxLength={2000} onChange={(event) => setNote(event.target.value)} value={note} /></Field>
        {error && <p aria-live="polite" className="text-body text-red-700">{error}</p>}
      </form>
    </Modal>
  )
}
