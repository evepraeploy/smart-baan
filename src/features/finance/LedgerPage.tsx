import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'
import { ArrowDownLeft, ArrowUpRight, LockKeyhole, Pencil, Plus, ReceiptText, Trash2 } from 'lucide-react'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { EmptyState } from '../../components/ui/EmptyState'
import { Field, Input, Textarea } from '../../components/ui/Field'
import { Modal } from '../../components/ui/Modal'
import { Select } from '../../components/ui/Select'
import { Spinner } from '../../components/ui/Spinner'
import { useToast } from '../../components/ui/Toast'
import { useOffline } from '../../components/layout/OfflineBanner'
import { compressSlipImage } from '../../lib/image'
import { currentBangkokDate, currentBangkokMonth } from '../../lib/date'
import { formatBaht, formatDateTH, formatMonthTH } from '../../lib/format'
import { messages } from '../../lib/messages.th'
import { toThaiError } from '../../lib/errors'
import {
  createLedgerEntry,
  deleteLedgerEntry,
  listLedgerEntries,
  updateLedgerEntry,
  uploadLedgerReceipt,
  type LedgerEntry,
  type LedgerInput,
  type LedgerType,
} from './api'
import { toCsv } from '../../lib/csv'

const categories: Record<LedgerType, string[]> = {
  income: ['ค่าส่วนกลาง', 'รายรับอื่น ๆ', 'ดอกเบี้ย', 'เงินบริจาค'],
  expense: ['ค่าไฟส่วนกลาง', 'ค่าน้ำ', 'ค่าจ้างรปภ.', 'ค่าทำความสะอาด', 'ค่าซ่อมบำรุง', 'อื่น ๆ'],
}

type LedgerForm = {
  entryType: LedgerType
  category: string
  amount: string
  entryDate: string
  description: string
  attachmentPath: string | null
  imageFile: File | null
}

function makeEmptyForm(): LedgerForm {
  return {
    entryType: 'expense',
    category: categories.expense[0],
    amount: '',
    entryDate: currentBangkokDate(),
    description: '',
    attachmentPath: null,
    imageFile: null,
  }
}

export function LedgerPage() {
  const { showToast } = useToast()
  const offline = useOffline()
  const [month, setMonth] = useState(currentBangkokMonth())
  const [entries, setEntries] = useState<LedgerEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<LedgerEntry | null>(null)
  const [form, setForm] = useState<LedgerForm>(makeEmptyForm)

  const refresh = useCallback(async () => {
    setLoading(true)
    try {
      setEntries(await listLedgerEntries(month))
      setError('')
    } catch (caught) {
      setError(toThaiError(caught))
    } finally {
      setLoading(false)
    }
  }, [month])
  useEffect(() => { void refresh() }, [refresh])

  const totals = useMemo(() => entries.reduce(
    (sum, entry) => {
      if (entry.entry_type === 'income') sum.income += Number(entry.amount)
      else sum.expense += Number(entry.amount)
      return sum
    },
    { income: 0, expense: 0 },
  ), [entries])

  function openCreate() {
    setEditing(null)
    setForm(makeEmptyForm())
    setError('')
    setModalOpen(true)
  }

  function openEdit(entry: LedgerEntry) {
    setEditing(entry)
    setForm({
      entryType: entry.entry_type,
      category: entry.category,
      amount: String(entry.amount),
      entryDate: entry.entry_date.slice(0, 10),
      description: entry.description ?? '',
      attachmentPath: entry.attachment_path,
      imageFile: null,
    })
    setError('')
    setModalOpen(true)
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (offline) return
    setError('')
    if (!form.category.trim()) return setError(messages.categoryRequired)
    if (!form.amount) return setError(messages.amountRequired)
    const amount = Number(form.amount)
    if (!Number.isFinite(amount) || amount <= 0) return setError(messages.ledgerAmountInvalid)
    if (!form.entryDate) return setError(messages.ledgerDateRequired)
    setBusy(true)
    let uploadedPath: string | null = null
    try {
      let attachmentPath = form.attachmentPath
      if (form.imageFile) {
        const compressed = await compressSlipImage(form.imageFile)
        uploadedPath = await uploadLedgerReceipt(compressed.file, compressed.ext)
        attachmentPath = uploadedPath
      }
      const input: LedgerInput = {
        entry_type: form.entryType,
        category: form.category,
        amount,
        entry_date: form.entryDate,
        description: form.description.trim() || null,
        attachment_path: attachmentPath,
      }
      if (editing) await updateLedgerEntry(editing.id, input)
      else await createLedgerEntry(input)
      showToast(messages.ledgerSaved)
      setModalOpen(false)
      await refresh()
    } catch (caught) {
      setError(toThaiError(caught))
    } finally {
      setBusy(false)
    }
  }

  async function remove(entry: LedgerEntry) {
    if (offline) return
    if (!window.confirm('ลบรายการนี้ใช่หรือไม่?')) return
    setBusy(true)
    setError('')
    try {
      await deleteLedgerEntry(entry.id)
      showToast(messages.ledgerDeleted)
      await refresh()
    } catch (caught) {
      setError(toThaiError(caught))
    } finally {
      setBusy(false)
    }
  }

  function exportCsv() {
    const rows = [
      ['วันที่ พ.ศ.', 'ประเภท', 'หมวดหมู่', 'รายละเอียด', 'บ้านเลขที่', 'ยอดเงิน'],
      ...entries.map((entry) => [
        formatDateTH(entry.entry_date),
        entry.entry_type === 'income' ? 'รายรับ' : 'รายจ่าย',
        entry.category,
        entry.description ?? '',
        entry.house_no ?? '',
        formatBaht(entry.amount),
      ]),
    ]
    const url = URL.createObjectURL(new Blob([toCsv(rows)], { type: 'text/csv;charset=utf-8' }))
    const link = document.createElement('a')
    link.href = url
    link.download = `ledger-${month}.csv`
    link.click()
    window.setTimeout(() => URL.revokeObjectURL(url), 0)
  }

  return (
    <div className="grid gap-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-h1 font-bold text-text-heading">รายรับ-รายจ่าย</h1>
          <p className="text-body text-text-muted">{formatMonthTH(`${month}-01`)}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button onClick={exportCsv} variant="secondary">ส่งออก CSV</Button>
          <Button disabled={offline} onClick={openCreate}><Plus aria-hidden="true" size={20} />เพิ่มรายการ</Button>
        </div>
      </div>
      {offline && <p className="text-body text-secondary">{messages.offlineFinance}</p>}
      <Card className="grid gap-4 sm:grid-cols-3">
        <div><p className="text-body text-text-muted">รายรับเดือนนี้</p><p className="font-display text-h2 font-bold tabular-nums text-primary">{formatBaht(totals.income)}</p></div>
        <div><p className="text-body text-text-muted">รายจ่ายเดือนนี้</p><p className="font-display text-h2 font-bold tabular-nums text-danger">{formatBaht(totals.expense)}</p></div>
        <div><p className="text-body text-text-muted">สุทธิเดือนนี้</p><p className="font-display text-h2 font-bold tabular-nums text-text-heading">{formatBaht(totals.income - totals.expense)}</p></div>
      </Card>
      <Card className="grid gap-2 sm:max-w-xs">
        <Field hint={formatMonthTH(`${month}-01`)} label="เลือกเดือน">
          <Input onChange={(event) => { if (event.target.value) setMonth(event.target.value) }} type="month" value={month} />
        </Field>
      </Card>
      {error && <p aria-live="polite" className="rounded-md bg-tint-danger p-3 text-body text-danger">{error}</p>}
      {loading ? <Spinner /> : entries.length ? entries.map((entry) => {
        const income = entry.entry_type === 'income'
        const Icon = income ? ArrowDownLeft : ArrowUpRight
        return (
          <Card className="grid gap-4 sm:grid-cols-[1fr_auto]" key={entry.id}>
            <div className="flex items-start gap-3">
              <span className={`grid size-11 shrink-0 place-items-center rounded-full ${income ? 'bg-status-success-bg text-status-success-fg' : 'bg-status-danger-bg text-status-danger-fg'}`}>
                <Icon aria-hidden="true" size={22} />
              </span>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="font-display text-h2 font-bold text-text-heading">{entry.category}</h2>
                  <span className={`rounded-full px-3 py-1 text-caption font-semibold ${income ? 'bg-status-success-bg text-status-success-fg' : 'bg-status-danger-bg text-status-danger-fg'}`}>{income ? 'รายรับ' : 'รายจ่าย'}</span>
                </div>
                <p className="mt-1 text-body text-text-muted">{formatDateTH(entry.entry_date)}{entry.description ? ` · ${entry.description}` : ''}</p>
                {entry.slip_id && <p className="mt-1 flex items-center gap-1 text-caption font-semibold text-text-muted"><LockKeyhole aria-hidden="true" size={16} />รายการจากสลิป แก้ไขไม่ได้{entry.house_no ? ` · บ้านเลขที่ ${entry.house_no}` : ''}</p>}
                {entry.signed_url && <a className="mt-3 inline-block" href={entry.signed_url} rel="noreferrer" target="_blank"><img alt={`ใบเสร็จรายการ${entry.category}`} className="size-24 rounded-md border border-outline-soft object-cover" src={entry.signed_url} /></a>}
              </div>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-3 sm:flex-col sm:items-end">
              <p className={`font-display text-h2 font-bold tabular-nums ${income ? 'text-primary' : 'text-danger'}`}>{formatBaht(entry.amount)}</p>
              {!entry.slip_id && <div className="flex gap-2">
                <Button aria-label={`แก้ไขรายการ ${entry.category}`} className="min-w-touch px-3" disabled={offline || busy} onClick={() => openEdit(entry)} variant="secondary"><Pencil aria-hidden="true" size={20} /></Button>
                <Button aria-label={`ลบรายการ ${entry.category}`} className="min-w-touch px-3" disabled={offline || busy} onClick={() => void remove(entry)} variant="danger-outline"><Trash2 aria-hidden="true" size={20} /></Button>
              </div>}
            </div>
          </Card>
        )
      }) : !error && <Card><EmptyState description="เพิ่มรายรับหรือรายจ่ายเพื่อเริ่มบันทึกบัญชีหมู่บ้าน" icon={ReceiptText} title="ไม่มีรายการในเดือนนี้" /></Card>}

      <Modal
        busy={busy}
        footer={(
          <>
            <Button disabled={busy} onClick={() => setModalOpen(false)} type="button" variant="secondary">ยกเลิก</Button>
            <Button busy={busy} disabled={offline} form="ledger-form" type="submit">บันทึกรายการ</Button>
          </>
        )}
        onClose={() => setModalOpen(false)}
        open={modalOpen}
        title={editing ? 'แก้ไขรายการ' : 'เพิ่มรายการ'}
      >
        <form className="grid gap-4" id="ledger-form" noValidate onSubmit={submit}>
          <Field label="ประเภท">
            <Select onChange={(event) => {
              const entryType = event.target.value as LedgerType
              setForm({ ...form, entryType, category: categories[entryType][0] })
            }} value={form.entryType}>
              <option value="income">รายรับ</option>
              <option value="expense">รายจ่าย</option>
            </Select>
          </Field>
          <Field label="หมวดหมู่">
            <Select onChange={(event) => setForm({ ...form, category: event.target.value })} value={form.category}>
              {!categories[form.entryType].includes(form.category) && <option value={form.category}>{form.category}</option>}
              {categories[form.entryType].map((category) => <option key={category} value={category}>{category}</option>)}
            </Select>
          </Field>
          <Field label="ยอดเงิน (บาท)">
            <Input enterKeyHint="done" inputMode="decimal" min="0.01" onChange={(event) => setForm({ ...form, amount: event.target.value })} required step="0.01" type="number" value={form.amount} />
          </Field>
          <Field hint={form.entryDate ? formatDateTH(form.entryDate) : undefined} label="วันที่">
            <Input onChange={(event) => setForm({ ...form, entryDate: event.target.value })} required type="date" value={form.entryDate} />
          </Field>
          <Field label="รายละเอียด (ไม่บังคับ)">
            <Textarea maxLength={1000} onChange={(event) => setForm({ ...form, description: event.target.value })} value={form.description} />
          </Field>
          <Field hint="รูปจะถูกย่อให้มีขนาดไม่เกิน 200 KB" label="รูปบิล (ไม่บังคับ)">
            <Input accept="image/*" onChange={(event) => setForm({ ...form, imageFile: event.target.files?.[0] ?? null })} type="file" />
          </Field>
          {form.imageFile && <p className="text-caption text-text-muted">{form.imageFile.name}</p>}
          {form.attachmentPath && !form.imageFile && <p className="text-caption text-text-muted">มีรูปบิลแนบอยู่แล้ว</p>}
          {error && <p aria-live="polite" className="text-body text-danger">{error}</p>}
          {offline && <p className="text-body text-secondary">{messages.offlineFinance}</p>}
        </form>
      </Modal>
    </div>
  )
}
