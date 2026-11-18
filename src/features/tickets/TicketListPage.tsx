import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import { ChevronRight, Plus, Users, Wrench } from 'lucide-react'
import { Card } from '../../components/ui/Card'
import { EmptyState } from '../../components/ui/EmptyState'
import { IconTile } from '../../components/ui/IconTile'
import { Spinner } from '../../components/ui/Spinner'
import { toneClass } from '../../components/ui/statusTone'
import { useAuth } from '../auth/AuthProvider'
import { formatDateTimeTH } from '../../lib/format'
import { isMissingBackendFeature, toThaiError } from '../../lib/errors'
import { listCommunityTickets, listMyTickets, type CommunityTicket, type Ticket, type TicketCategory, type TicketStatus } from './api'
import { ticketCategoryIcons, ticketCategoryLabels, ticketStatusLabels, ticketStatusStyles } from './labels'
import { TicketFilters } from './TicketFilters'

const statuses: TicketStatus[] = ['pending', 'in_progress', 'done', 'rejected']
const validStatus = (value: string | null): TicketStatus => statuses.includes(value as TicketStatus) ? value as TicketStatus : 'pending'
const validCategory = (value: string | null): TicketCategory | 'all' => ['electric', 'plumbing', 'road', 'cleaning', 'security', 'other'].includes(value ?? '') ? value as TicketCategory : 'all'

export function TicketListPage() {
  const { session, house, roles } = useAuth()
  const [params, setParams] = useSearchParams()
  const [mine, setMine] = useState<Ticket[]>([])
  const [community, setCommunity] = useState<CommunityTicket[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [communityUnavailable, setCommunityUnavailable] = useState(false)
  const tab = params.get('tab') === 'all' ? 'all' : 'mine'
  const status = validStatus(params.get('status'))
  const category = validCategory(params.get('category'))
  const committee = roles.includes('committee') || roles.includes('admin')
  const userId = session?.user.id

  useEffect(() => {
    if (tab !== 'mine') return
    if (!userId) { setMine([]); setLoading(false); return }
    let active = true
    setLoading(true)
    void listMyTickets(userId, house?.id ?? null).then((rows) => {
      if (active) { setMine(rows); setError('') }
    }).catch((caught) => {
      if (active) setError(toThaiError(caught))
    }).finally(() => {
      if (active) setLoading(false)
    })
    return () => { active = false }
  }, [house?.id, tab, userId])

  useEffect(() => {
    if (tab !== 'all') return
    let active = true
    setLoading(true)
    void listCommunityTickets().then((rows) => {
      if (active) { setCommunity(rows); setCommunityUnavailable(false); setError('') }
    }).catch((caught) => {
      if (!active) return
      if (isMissingBackendFeature(caught)) { setCommunity([]); setCommunityUnavailable(true); setError('') }
      else setError(toThaiError(caught))
    }).finally(() => {
      if (active) setLoading(false)
    })
    return () => { active = false }
  }, [tab])

  const filteredCommunity = useMemo(
    () => community.filter((ticket) => ticket.status === status && (category === 'all' || ticket.category === category)),
    [category, community, status],
  )
  const counts = useMemo(() => Object.fromEntries(statuses.map((value) => [
    value,
    community.filter((ticket) => ticket.status === value && (category === 'all' || ticket.category === category)).length,
  ])) as Record<TicketStatus, number>, [category, community])
  const categoryCounts = useMemo(() => Object.fromEntries([
    ['all', community.filter((ticket) => ticket.status === status).length],
    ...(['electric', 'plumbing', 'road', 'cleaning', 'security', 'other'] as TicketCategory[]).map((value) => [
      value,
      community.filter((ticket) => ticket.status === status && ticket.category === value).length,
    ]),
  ]) as Record<TicketCategory | 'all', number>, [community, status])

  function updateFilters(nextStatus: TicketStatus, nextCategory: TicketCategory | 'all') {
    const next = new URLSearchParams(params)
    next.set('status', nextStatus)
    if (nextCategory === 'all') next.delete('category')
    else next.set('category', nextCategory)
    setParams(next, { replace: true })
  }
  function changeTab(nextTab: 'mine' | 'all') {
    const next = new URLSearchParams(params)
    if (nextTab === 'all') next.set('tab', 'all')
    else next.delete('tab')
    setError('')
    setParams(next, { replace: true })
  }

  return (
    <div className="grid min-w-0 gap-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div><h1 className="font-display text-h1 font-bold text-text-heading">แจ้งซ่อม</h1><p className="text-body text-text-muted">ติดตามเรื่องที่แจ้งและปัญหาในหมู่บ้าน</p></div>
        <Link className="inline-flex min-h-touch items-center justify-center gap-2 rounded-md bg-primary-container px-5 font-semibold text-white hover:bg-primary" to="/repairs/new"><Plus aria-hidden="true" size={20} />แจ้งเรื่องใหม่</Link>
      </div>
      <div aria-label="รายการเรื่องซ่อม" className="grid grid-cols-2 rounded-lg bg-surface-low p-1" role="tablist">
        <button aria-selected={tab === 'mine'} className={`min-h-touch rounded-md px-3 font-semibold ${tab === 'mine' ? 'bg-surface text-primary shadow-card' : 'text-text-muted'}`} onClick={() => changeTab('mine')} role="tab" type="button">เรื่องของฉัน</button>
        <button aria-selected={tab === 'all'} className={`min-h-touch rounded-md px-3 font-semibold ${tab === 'all' ? 'bg-surface text-primary shadow-card' : 'text-text-muted'}`} onClick={() => changeTab('all')} role="tab" type="button">ทั้งหมู่บ้าน</button>
      </div>
      {tab === 'all' && communityUnavailable && !loading && (
        <Card><EmptyState description="ส่วนนี้จะเปิดให้ดูได้เร็ว ๆ นี้" icon={Wrench} title="ยังดูเรื่องของทั้งหมู่บ้านไม่ได้" /></Card>
      )}
      {tab === 'all' && !communityUnavailable && (
        <TicketFilters
          category={category}
          categoryCounts={categoryCounts}
          onCategoryChange={(value) => updateFilters(status, value)}
          onStatusChange={(value) => updateFilters(value, category)}
          showStatusOnWide
          status={status}
          statusCounts={counts}
        />
      )}
      {error && <p aria-live="polite" className="rounded-md bg-tint-danger p-3 text-body text-danger">{error}</p>}
      {loading ? <Spinner /> : tab === 'mine' ? mine.length ? (
        <div className="grid gap-3">
          {mine.map((ticket) => <MineTicketCard key={ticket.id} ticket={ticket} />)}
        </div>
      ) : !error && <Card><EmptyState description="บอกเราได้เมื่อมีสิ่งที่ต้องการให้ช่วยดูแล" icon={Wrench} title="ยังไม่มีเรื่องที่แจ้ง" /></Card> : filteredCommunity.length ? (
        <div className="grid gap-3 md:grid-cols-2">
          {filteredCommunity.map((ticket) => (
            <Link key={ticket.id} to={committee ? `/maintenance/${ticket.id}` : `/repairs/${ticket.id}`}>
              <Card className="flex min-h-[88px] items-center gap-3 transition hover:border-primary-container hover:shadow-card">
                <IconTile icon={ticketCategoryIcons[ticket.category]} size="M" tone="secondary" />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <TicketStatusBadge status={ticket.status} />
                    {ticket.is_mine && <span className="rounded-full bg-status-neutral-bg px-3 py-1 text-caption font-semibold text-status-neutral-fg">เรื่องของคุณ</span>}
                  </div>
                  <h2 className="mt-2 line-clamp-2 font-display text-h3 font-bold text-text-heading">{ticket.title}</h2>
                  <p className="mt-1 text-caption text-text-muted">{ticketCategoryLabels[ticket.category]} · {formatDateTimeTH(ticket.created_at)}</p>
                  {ticket.affected_count > 0 && <span className="mt-2 inline-flex min-h-8 items-center gap-1.5 rounded-full bg-status-neutral-bg px-3 text-caption font-semibold text-status-neutral-fg"><Users aria-hidden="true" size={16} />เจอปัญหานี้ {ticket.affected_count} บ้าน</span>}
                </div>
                <ChevronRight aria-hidden="true" className="shrink-0 text-text-muted" size={24} />
              </Card>
            </Link>
          ))}
        </div>
      ) : !error && !communityUnavailable && <Card><EmptyState icon={Wrench} title="ไม่มีเรื่องในสถานะนี้" /></Card>}
    </div>
  )
}

function MineTicketCard({ ticket }: { ticket: Ticket }) {
  return (
    <Link to={`/repairs/${ticket.id}`}>
      <Card className="flex min-h-[88px] items-center gap-3 hover:border-primary-container">
        <IconTile icon={ticketCategoryIcons[ticket.category]} size="M" tone="secondary" />
        <div className="min-w-0 flex-1">
          <TicketStatusBadge status={ticket.status} />
          <h2 className="mt-2 line-clamp-2 font-display text-h3 font-bold text-text-heading">{ticket.title}</h2>
          <p className="mt-1 text-caption text-text-muted">{ticketCategoryLabels[ticket.category]} · {formatDateTimeTH(ticket.created_at)}{ticket.house_no ? ` · บ้านเลขที่ ${ticket.house_no}` : ''}</p>
        </div>
        <ChevronRight aria-hidden="true" className="shrink-0 text-text-muted" size={24} />
      </Card>
    </Link>
  )
}

export function TicketStatusBadge({ status }: { status: TicketStatus }) {
  const { Icon, tone } = ticketStatusStyles[status]
  return <span className={`inline-flex min-h-8 items-center gap-1.5 rounded-full px-3 py-1 text-base leading-6 font-semibold ${toneClass(tone)}`}><Icon aria-hidden="true" size={16} />{ticketStatusLabels[status]}</span>
}
