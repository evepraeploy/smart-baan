import { useEffect, useMemo, useRef, useState, type ChangeEvent, type FormEvent } from 'react'
import { useNavigate, useSearchParams } from 'react-router'
import { Camera, ImagePlus, Upload, X } from 'lucide-react'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { Checkbox } from '../../components/ui/Checkbox'
import { EmptyState } from '../../components/ui/EmptyState'
import { Field, Input } from '../../components/ui/Field'
import { Modal } from '../../components/ui/Modal'
import { Spinner } from '../../components/ui/Spinner'
import { useOffline } from '../../components/layout/OfflineBanner'
import { useToast } from '../../components/ui/Toast'
import { useAuth } from '../auth/AuthProvider'
import { getHouseBills, submitSlip, type Bill } from './api'
import { compressSlipImage, type CompressedSlip } from '../../lib/image'
import { formatBaht, formatDateTimeInputTH, formatMonthTH, parseDateTimeInputTH } from '../../lib/format'
import { messages } from '../../lib/messages.th'
import { toThaiError } from '../../lib/errors'
import { supabase } from '../../lib/supabase'

function localDateTimeNow() {
  return formatDateTimeInputTH()
}

export function UploadSlipPage() {
  const { house } = useAuth()
  const { showToast } = useToast()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const cameraRef = useRef<HTMLInputElement>(null)
  const albumRef = useRef<HTMLInputElement>(null)
  const [bills, setBills] = useState<Bill[]>([])
  const [selected, setSelected] = useState<string[]>([])
  const [amount, setAmount] = useState('')
  const [transferredAt, setTransferredAt] = useState(localDateTimeNow)
  const [compressed, setCompressed] = useState<CompressedSlip | null>(null)
  const [previewUrl, setPreviewUrl] = useState('')
  const [zoomOpen, setZoomOpen] = useState(false)
  const [loading, setLoading] = useState(true)
  const [compressing, setCompressing] = useState(false)
  const [progress, setProgress] = useState('')
  const [error, setError] = useState('')
  const offline = useOffline()
  const unpaidBills = bills.filter((bill) => bill.status === 'unpaid')
  const selectedAmount = useMemo(
    () => unpaidBills.filter((bill) => selected.includes(bill.id)).reduce((sum, bill) => sum + Number(bill.amount), 0),
    [selected, unpaidBills],
  )

  useEffect(() => {
    let active = true
    if (!house) {
      setLoading(false)
      return () => { active = false }
    }
    setLoading(true)
    void getHouseBills(house.id)
      .then((items) => {
        if (!active) return
        const unpaid = items.filter((bill) => bill.status === 'unpaid').sort((a, b) => a.period.localeCompare(b.period))
        setBills(items)
        const requested = searchParams.get('bill')
        const initial = requested && unpaid.some((bill) => bill.id === requested) ? requested : unpaid[0]?.id
        setSelected(initial ? [initial] : [])
      })
      .catch((caught: unknown) => {
        if (active) setError(toThaiError(caught))
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => { active = false }
  }, [house, searchParams])

  useEffect(() => {
    setAmount(selectedAmount ? selectedAmount.toFixed(2) : '')
  }, [selectedAmount])

  useEffect(() => () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl)
  }, [previewUrl])

  async function onFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    setError('')
    setCompressing(true)
    setProgress('กำลังย่อรูป...')
    try {
      const result = await compressSlipImage(file)
      setCompressed(result)
      setPreviewUrl(URL.createObjectURL(result.file))
    } catch (caught) {
      setError(toThaiError(caught))
    } finally {
      setCompressing(false)
      setProgress('')
    }
  }

  function toggleBill(id: string) {
    setSelected((current) => current.includes(id) ? current.filter((value) => value !== id) : [...current, id])
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    if (!selected.length) return setError(messages.monthRequired)
    if (!Number(amount) || Number(amount) <= 0) return setError(messages.amountRequired)
    if (!transferredAt) return setError(messages.dateRequired)
    if (!compressed) return setError(messages.uploadImageRequired)
    if (!house || !supabase) return setError(messages.generic)
    if (offline) return setError(messages.offlineUpload)

    const transferredDate = parseDateTimeInputTH(transferredAt)
    const monthParts = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Bangkok',
      year: 'numeric',
      month: '2-digit',
    }).formatToParts(transferredDate)
    const month = `${monthParts.find((part) => part.type === 'year')?.value}-${monthParts.find((part) => part.type === 'month')?.value}`
    const path = `${house.id}/${month}/${crypto.randomUUID()}.${compressed.ext}`
    try {
      setProgress('กำลังส่งรูป...')
      const { error: uploadError } = await supabase.storage.from('slips').upload(path, compressed.file, {
        contentType: compressed.file.type,
        cacheControl: '3600',
        upsert: false,
      })
      if (uploadError) throw uploadError
      setProgress('กำลังบันทึก...')
      await submitSlip({
        billIds: selected,
        amount: Number(amount),
        transferredAt: transferredDate.toISOString(),
        filePath: path,
        fileSize: compressed.compressedSize,
      })
      showToast(messages.submitSuccess)
      navigate('/payments/history')
    } catch (caught) {
      setError(toThaiError(caught))
    } finally {
      setProgress('')
    }
  }

  if (loading) return <Spinner />
  if (!house) {
    return <Card><EmptyState description="บัญชีนี้ไม่ได้ผูกกับบ้าน จึงส่งสลิปไม่ได้" icon={Upload} title="ไม่สามารถส่งสลิปได้" /></Card>
  }
  if (!unpaidBills.length) {
    return <Card><EmptyState description="เมื่อมีบิลที่รอชำระ รายการจะแสดงที่นี่" icon={Upload} title="ไม่มีบิลที่รอชำระ" /></Card>
  }

  return (
    <div className="mx-auto grid max-w-3xl gap-5">
      <Card>
        <form className="grid gap-6" noValidate onSubmit={submit}>
          <div>
            <h1 className="text-h1 font-bold text-text-heading">ส่งสลิปค่าส่วนกลาง</h1>
            <p className="mt-1 text-body text-text-muted">บ้านเลขที่ {house?.house_no ?? '—'} · บ้านของคุณ</p>
          </div>
          <fieldset className="grid gap-3">
            <legend className="mb-2 text-body font-semibold text-text-heading">เลือกเดือนที่ชำระ</legend>
            {unpaidBills.map((bill) => (
              <label key={bill.id} className="flex min-h-touch cursor-pointer items-center gap-3 rounded-md border border-border p-3 hover:border-primary-700">
                <Checkbox checked={selected.includes(bill.id)} onChange={() => toggleBill(bill.id)} />
                <span className="flex-1 text-body font-semibold text-text-heading">{formatMonthTH(bill.period)}</span>
                <span className="text-body text-text-muted">{formatBaht(bill.amount)}</span>
              </label>
            ))}
          </fieldset>
          <Field label="ยอดเงินที่โอน">
            <div className="relative">
              <Input inputMode="decimal" min="0.01" onChange={(event) => setAmount(event.target.value)} placeholder="0.00" required step="0.01" type="number" value={amount} />
              <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-text-muted">บาท</span>
            </div>
          </Field>
          <Field label="วันและเวลาที่โอน">
            <Input onChange={(event) => setTransferredAt(event.target.value)} required type="datetime-local" value={transferredAt} />
          </Field>
          <div className="grid gap-3">
            <p className="text-body font-semibold text-text-heading">รูปสลิป</p>
            <input accept="image/*,.heic,.heif" capture="environment" className="sr-only" onChange={onFile} ref={cameraRef} type="file" />
            <input accept="image/*,.heic,.heif" className="sr-only" onChange={onFile} ref={albumRef} type="file" />
            <div className="grid gap-3 sm:grid-cols-2">
              <Button disabled={compressing} onClick={() => cameraRef.current?.click()} type="button" variant="secondary"><Camera size={21} />ถ่ายรูปสลิป</Button>
              <Button disabled={compressing} onClick={() => albumRef.current?.click()} type="button" variant="secondary"><ImagePlus size={21} />เลือกจากอัลบั้ม</Button>
            </div>
          </div>
          {compressing && <p aria-live="polite" className="text-body font-semibold text-primary-700">{progress}</p>}
          {compressed && (
            <div className="grid gap-3">
              <button className="overflow-hidden rounded-lg border border-border bg-subtle" onClick={() => setZoomOpen(true)} type="button">
                <img alt="ตัวอย่างรูปสลิป" className="max-h-96 w-full object-contain" src={previewUrl} />
              </button>
              <p className="text-caption text-text-muted">ขนาดหลังย่อ {(compressed.compressedSize / 1024).toFixed(0)} KB</p>
              <Button onClick={() => { setCompressed(null); setPreviewUrl('') }} type="button" variant="secondary"><X size={20} />เปลี่ยนรูปใหม่</Button>
            </div>
          )}
          {error && <p aria-live="polite" className="rounded-md bg-red-50 p-3 text-body text-red-700">{error}</p>}
          {offline && <p className="text-body text-amber-800">{messages.offlineUpload}</p>}
          {progress && !compressing && <p aria-live="polite" className="text-body font-semibold text-primary-700">{progress}</p>}
          <Button busy={Boolean(progress && !compressing)} className="w-full" disabled={offline || compressing} type="submit">ส่งสลิป</Button>
        </form>
      </Card>
      <Modal onClose={() => setZoomOpen(false)} open={zoomOpen} title="รูปสลิป">
        <img alt="รูปสลิปขนาดใหญ่" className="max-h-[75vh] w-full object-contain" src={previewUrl} />
      </Modal>
    </div>
  )
}
