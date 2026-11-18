import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router'
import { Ban, CalendarClock, CheckCircle2, HardHat, Plus, Search, Wrench } from 'lucide-react'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { toneClass } from '../../components/ui/statusTone'
import { EmptyState } from '../../components/ui/EmptyState'
import { Field, Input } from '../../components/ui/Field'
import { Select } from '../../components/ui/Select'
import { Spinner } from '../../components/ui/Spinner'
import { formatDateTH } from '../../lib/format'
import { getPmStatus } from '../../lib/pm-status'
import { toThaiError } from '../../lib/errors'
import { useOffline } from '../../components/layout/OfflineBanner'
import { listAssets, type Asset, type AssetStatus } from './api'
import { AssetEditorModal } from './AssetEditorModal'

function todayBangkok() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Bangkok', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date())
}

const assetStatusText: Record<AssetStatus, string> = { active: 'ใช้งาน', repair: 'ซ่อม', retired: 'เลิกใช้' }
const assetStatusIcon = { active: CheckCircle2, repair: Wrench, retired: Ban }

export function PmBadge({ nextDueDate }: { nextDueDate: string | null }) {
  const status = getPmStatus(nextDueDate, todayBangkok())
  const tone = status === 'overdue' ? 'danger' : status === 'soon' ? 'warning' : 'neutral'
  const label = {
    overdue: 'เลยกำหนด',
    soon: 'ใกล้ถึงกำหนด',
    ok: 'ปกติ',
    none: 'ไม่กำหนด PM',
  }[status]
  return <span className={`inline-flex min-h-8 items-center gap-1.5 rounded-full px-3 py-1 text-base leading-6 font-semibold ${toneClass(tone)}`}><CalendarClock aria-hidden="true" size={16} />{label}{nextDueDate && ` · ${formatDateTH(nextDueDate)}`}</span>
}

export function AssetsPage() {
  const offline = useOffline()
  const [assets, setAssets] = useState<Asset[]>([])
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState<AssetStatus | 'all'>('all')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [editorOpen, setEditorOpen] = useState(false)
  const [editingAsset, setEditingAsset] = useState<Asset | null>(null)

  const refresh = useCallback(async () => {
    setLoading(true)
    try {
      setAssets(await listAssets())
      setError('')
    } catch (caught) {
      setError(toThaiError(caught))
    } finally {
      setLoading(false)
    }
  }, [])
  useEffect(() => { void refresh() }, [refresh])

  const filteredAssets = useMemo(() => assets.filter((asset) => (
    (status === 'all' || asset.status === status)
    && `${asset.name} ${asset.category ?? ''} ${asset.location ?? ''}`.toLowerCase().includes(search.trim().toLowerCase())
  )), [assets, search, status])

  return (
    <div className="grid gap-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div><h1 className="font-display text-h1 font-bold text-text-heading">ทะเบียนอุปกรณ์ส่วนกลาง</h1><p className="text-body text-text-muted">ดูแลอุปกรณ์และติดตามรอบบำรุงรักษา</p></div>
        <Button disabled={offline} onClick={() => { setEditingAsset(null); setEditorOpen(true) }}><Plus aria-hidden="true" size={20} />เพิ่มอุปกรณ์</Button>
      </div>
      <Card className="grid gap-3 sm:grid-cols-[1fr_auto]">
        <Field label="ค้นหาอุปกรณ์"><Input onChange={(event) => setSearch(event.target.value)} placeholder="ชื่อ ประเภท หรือตำแหน่ง" value={search} /><Search aria-hidden="true" className="sr-only" /></Field>
        <Field label="สถานะ">
          <Select onChange={(event) => setStatus(event.target.value as AssetStatus | 'all')} value={status}>
            <option value="all">ทุกสถานะ</option><option value="active">ใช้งาน</option><option value="repair">ซ่อม</option><option value="retired">เลิกใช้</option>
          </Select>
        </Field>
      </Card>
      {error && <p aria-live="polite" className="rounded-md bg-tint-danger p-3 text-body text-danger">{error}</p>}
      {loading ? <Spinner /> : filteredAssets.length ? filteredAssets.map((asset) => (
        <Link key={asset.id} to={`/assets/${asset.id}`}>
          <Card className="flex flex-wrap items-center gap-4 hover:border-primary-container">
            {asset.signed_url ? <img alt="" className="size-20 rounded-md object-cover" src={asset.signed_url} /> : <span className="grid size-20 place-items-center rounded-md bg-primary-fixed text-on-primary-fixed"><HardHat aria-hidden="true" size={28} /></span>}
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2"><h2 className="font-display text-h2 font-bold text-text-heading">{asset.name}</h2><AssetStatusBadge status={asset.status} /></div>
              <p className="mt-1 text-caption text-text-muted">{[asset.category, asset.location].filter(Boolean).join(' · ') || 'ไม่ระบุประเภทหรือตำแหน่ง'}</p>
              <div className="mt-2"><PmBadge nextDueDate={asset.next_due_date} /></div>
            </div>
          </Card>
        </Link>
      )) : !error && <Card><EmptyState icon={HardHat} title="ไม่พบอุปกรณ์" description="เพิ่มอุปกรณ์ส่วนกลาง หรือปรับคำค้นหาและตัวกรอง" /></Card>}
      <AssetEditorModal asset={editingAsset} onClose={() => setEditorOpen(false)} onSaved={() => void refresh()} open={editorOpen} />
    </div>
  )
}

export function AssetStatusBadge({ status }: { status: AssetStatus }) {
  const Icon = assetStatusIcon[status]
  const tone = status === 'active' ? 'success' : status === 'repair' ? 'warning' : 'neutral'
  return <span className={`inline-flex min-h-8 items-center gap-1.5 rounded-full px-3 py-1 text-base leading-6 font-semibold ${toneClass(tone)}`}><Icon aria-hidden="true" size={16} />{assetStatusText[status]}</span>
}
