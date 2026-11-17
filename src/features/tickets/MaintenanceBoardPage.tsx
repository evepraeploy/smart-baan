import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router'
import { ClipboardList, Filter } from 'lucide-react'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { EmptyState } from '../../components/ui/EmptyState'
import { Select } from '../../components/ui/Select'
import { Spinner } from '../../components/ui/Spinner'
import { formatDateTimeTH } from '../../lib/format'
import { toThaiError } from '../../lib/errors'
import { listMaintenanceTickets, type Ticket, type TicketCategory, type TicketStatus } from './api'
import { ticketCategoryLabels, ticketStatusLabels, ticketStatusStyles } from './labels'

const columns: TicketStatus[] = ['pending', 'in_progress', 'done', 'rejected']
const categoryOptions: TicketCategory[] = ['electric', 'plumbing', 'road', 'cleaning', 'security', 'other']

export function MaintenanceBoardPage() {
  const [tickets, setTickets] = useState<Ticket[]>([])
  const [activeStatus, setActiveStatus] = useState<TicketStatus>('pending')
  const [category, setCategory] = useState<TicketCategory | 'all'>('all')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const refresh = useCallback(async () => {
    setLoading(true)
    try {
      setTickets(await listMaintenanceTickets())
      setError('')
    } catch (caught) {
      setError(toThaiError(caught))
    } finally {
      setLoading(false)
    }
  }, [])
  useEffect(() => { void refresh() }, [refresh])

  const grouped = useMemo(() => Object.fromEntries(columns.map((status) => [
    status,
    tickets.filter((ticket) => ticket.status === status && (category === 'all' || ticket.category === category)),
  ])) as Record<TicketStatus, Ticket[]>, [category, tickets])

  return (
    <div className="grid gap-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div><h1 className="text-h1 font-bold text-text-heading">บอร์ดงานซ่อม</h1><p className="text-body text-text-muted">ติดตามและจัดการเรื่องที่แจ้งเข้ามา</p></div>
        <label className="grid gap-1 text-caption font-semibold text-text-heading">
          <span className="flex items-center gap-1"><Filter aria-hidden="true" size={16} />หมวดหมู่</span>
          <Select onChange={(event) => setCategory(event.target.value as TicketCategory | 'all')} value={category}>
            <option value="all">ทุกหมวดหมู่</option>
            {categoryOptions.map((item) => <option key={item} value={item}>{ticketCategoryLabels[item]}</option>)}
          </Select>
        </label>
      </div>
      <div aria-label="เลือกสถานะ" className="flex gap-2 overflow-x-auto lg:hidden">
        {columns.map((status) => (
          <Button className="shrink-0 px-3" key={status} onClick={() => setActiveStatus(status)} variant={status === activeStatus ? 'primary' : 'secondary'}>
            {ticketStatusLabels[status]} ({grouped[status]?.length ?? 0})
          </Button>
        ))}
      </div>
      {error && <p aria-live="polite" className="rounded-md bg-red-50 p-3 text-body text-red-700">{error}</p>}
      {loading ? <Spinner /> : (
        <div className="grid min-w-0 gap-4 lg:grid-cols-4">
          {columns.map((status) => {
            const { Icon, className } = ticketStatusStyles[status]
            return (
              <section className={`min-w-0 ${activeStatus === status ? 'grid' : 'hidden'} content-start gap-3 lg:grid`} key={status}>
                <h2 className={`flex min-h-touch items-center gap-2 rounded-md px-3 font-bold ${className}`}><Icon aria-hidden="true" size={20} />{ticketStatusLabels[status]} <span className="ml-auto tabular-nums">{grouped[status].length}</span></h2>
                {grouped[status].length ? grouped[status].map((ticket) => (
                  <Link key={ticket.id} to={`/maintenance/${ticket.id}`}>
                    <Card className="hover:border-primary-700">
                      <p className="text-caption font-semibold text-primary-700">{ticket.house_no ? `บ้านเลขที่ ${ticket.house_no}` : 'ไม่ผูกกับบ้าน'} · {ticketCategoryLabels[ticket.category]}</p>
                      <h3 className="mt-2 break-words text-body-lg font-bold text-text-heading">{ticket.title}</h3>
                      <p className="mt-2 text-caption text-text-muted">{formatDateTimeTH(ticket.created_at)}</p>
                    </Card>
                  </Link>
                )) : <Card className="p-4"><EmptyState icon={ClipboardList} title="ไม่มีเรื่องในสถานะนี้" /></Card>}
              </section>
            )
          })}
        </div>
      )}
    </div>
  )
}
