import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import { ChevronRight, ClipboardList, Users } from 'lucide-react'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { EmptyState } from '../../components/ui/EmptyState'
import { IconTile } from '../../components/ui/IconTile'
import { Spinner } from '../../components/ui/Spinner'
import { toneClass } from '../../components/ui/statusTone'
import { formatDateTimeTH } from '../../lib/format'
import { toThaiError } from '../../lib/errors'
import { listMaintenanceTickets, type Ticket, type TicketCategory, type TicketStatus } from './api'
import { ticketCategoryIcons, ticketCategoryLabels, ticketStatusLabels, ticketStatusStyles } from './labels'
import { TicketFilters } from './TicketFilters'

const columns: TicketStatus[] = ['pending', 'in_progress', 'done', 'rejected']
const categories: TicketCategory[] = ['electric', 'plumbing', 'road', 'cleaning', 'security', 'other']
const parseStatus = (value: string | null): TicketStatus => columns.includes(value as TicketStatus) ? value as TicketStatus : 'pending'
const parseCategory = (value: string | null): TicketCategory | 'all' => categories.includes(value as TicketCategory) ? value as TicketCategory : 'all'

export function MaintenanceBoardPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const [tickets, setTickets] = useState<Ticket[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const status = parseStatus(searchParams.get('status'))
  const category = parseCategory(searchParams.get('category'))
  const filtered = useMemo(() => tickets.filter((ticket) => category === 'all' || ticket.category === category), [category, tickets])
  const grouped = useMemo(() => Object.fromEntries(columns.map((value) => [value, filtered.filter((ticket) => ticket.status === value)])) as Record<TicketStatus, Ticket[]>, [filtered])
  const categoryCounts = useMemo(() => Object.fromEntries([
    ['all', tickets.filter((ticket) => ticket.status === status).length],
    ...categories.map((value) => [value, tickets.filter((ticket) => ticket.status === status && ticket.category === value).length]),
  ]) as Record<TicketCategory | 'all', number>, [status, tickets])

  const refresh = useCallback(async () => {
    setLoading(true)
    try { setTickets(await listMaintenanceTickets()); setError('') }
    catch (caught) { setError(toThaiError(caught)) }
    finally { setLoading(false) }
  }, [])
  useEffect(() => { void refresh() }, [refresh])

  function update(nextStatus: TicketStatus, nextCategory: TicketCategory | 'all') {
    const next = new URLSearchParams(searchParams)
    next.set('status', nextStatus)
    if (nextCategory === 'all') next.delete('category')
    else next.set('category', nextCategory)
    setSearchParams(next, { replace: true })
  }

  return (
    <div className="grid min-w-0 gap-5">
      <div className="sr-only lg:not-sr-only lg:grid lg:gap-2">
        <h1 className="lg:font-display lg:text-h1 lg:font-bold lg:text-text-heading">บอร์ดงานซ่อม</h1>
        <p className="hidden text-body text-text-muted lg:block">ติดตามและจัดการเรื่องที่แจ้งเข้ามา</p>
      </div>
      <TicketFilters
        category={category}
        categoryCounts={categoryCounts}
        onCategoryChange={(value) => update(status, value)}
        onStatusChange={(value) => update(value, category)}
        status={status}
        statusCounts={Object.fromEntries(columns.map((value) => [value, grouped[value].length])) as Record<TicketStatus, number>}
      />
      {error && <p aria-live="polite" className="rounded-md bg-tint-danger p-3 text-body text-danger">{error}</p>}
      {loading ? <Spinner /> : (
        <div className="grid min-w-0 gap-4 2xl:grid-cols-4">
          {columns.map((column) => {
            const { Icon, tone } = ticketStatusStyles[column]
            const items = grouped[column]
            return (
              <section className={`min-w-0 ${status === column ? 'grid' : 'hidden'} content-start gap-3 md:grid-cols-2 2xl:grid 2xl:grid-cols-1`} key={column}>
                <h2 className={`hidden min-h-touch items-center gap-2 rounded-md px-3 font-bold 2xl:flex ${toneClass(tone)}`}>
                  <Icon aria-hidden="true" size={20} />{ticketStatusLabels[column]}<span className="ml-auto tabular-nums">{items.length}</span>
                </h2>
                {items.length ? items.map((ticket) => {
                  const CategoryIcon = ticketCategoryIcons[ticket.category]
                  return (
                    <Link key={ticket.id} to={`/maintenance/${ticket.id}`}>
                      <Card className="flex min-h-[88px] items-center gap-3 transition hover:border-primary-container hover:shadow-card">
                        <IconTile icon={CategoryIcon} size="M" tone="secondary" />
                        <div className="min-w-0 flex-1">
                          <p className="text-caption font-semibold text-text-muted">{ticket.house_no ? `บ้านเลขที่ ${ticket.house_no}` : 'ไม่ผูกกับบ้าน'} · {ticketCategoryLabels[ticket.category]}</p>
                          <h3 className="line-clamp-2 font-display text-h3 font-bold text-text-heading">{ticket.title}</h3>
                          <p className="mt-1 text-caption text-text-muted">{formatDateTimeTH(ticket.created_at)}</p>
                          {(ticket.affected_count ?? 0) > 0 && <span className="mt-2 inline-flex min-h-8 items-center gap-1.5 rounded-full bg-status-neutral-bg px-3 text-caption font-semibold text-status-neutral-fg"><Users aria-hidden="true" size={16} />เจอปัญหานี้ {ticket.affected_count} บ้าน</span>}
                        </div>
                        <ChevronRight aria-hidden="true" className="shrink-0 text-text-muted" size={24} />
                      </Card>
                    </Link>
                  )
                }) : (
                  <Card className="md:col-span-2 2xl:col-span-1"><EmptyState
                    action={category !== 'all' && <Button onClick={() => update(status, 'all')} variant="quiet">ดูทุกหมวดหมู่</Button>}
                    description={category === 'all' ? undefined : `ไม่มีเรื่องในหมวด ${ticketCategoryLabels[category]}`}
                    icon={ClipboardList}
                    title={category === 'all' ? 'ไม่มีเรื่องในสถานะนี้' : `ไม่มีเรื่องในหมวด ${ticketCategoryLabels[category]}`}
                  /></Card>
                )}
              </section>
            )
          })}
        </div>
      )}
    </div>
  )
}
