import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router'
import { ArrowRight, Plus, Wrench } from 'lucide-react'
import { Card } from '../../components/ui/Card'
import { EmptyState } from '../../components/ui/EmptyState'
import { Spinner } from '../../components/ui/Spinner'
import { formatDateTH } from '../../lib/format'
import { toThaiError } from '../../lib/errors'
import { useAuth } from '../auth/AuthProvider'
import { listMyTickets, type Ticket, type TicketStatus } from './api'
import { ticketCategoryLabels, ticketStatusLabels, ticketStatusStyles } from './labels'

export function TicketListPage() {
  const { session, house } = useAuth()
  const [tickets, setTickets] = useState<Ticket[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const userId = session?.user.id

  const refresh = useCallback(async () => {
    if (!userId) {
      setTickets([])
      setLoading(false)
      return
    }
    setLoading(true)
    try {
      setTickets(await listMyTickets(userId, house?.id ?? null))
      setError('')
    } catch (caught) {
      setError(toThaiError(caught))
    } finally {
      setLoading(false)
    }
  }, [house?.id, userId])
  useEffect(() => { void refresh() }, [refresh])

  return (
    <div className="grid gap-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-h1 font-bold text-text-heading">เรื่องของฉัน</h1>
          <p className="text-body text-text-muted">ติดตามเรื่องที่แจ้งและความคืบหน้าการแก้ไข</p>
        </div>
        <Link className="inline-flex min-h-control items-center justify-center gap-2 rounded-md bg-primary-700 px-5 text-body font-semibold text-white hover:bg-primary-800" to="/repairs/new"><Plus aria-hidden="true" size={20} />แจ้งเรื่องใหม่</Link>
      </div>
      {error && <p aria-live="polite" className="rounded-md bg-red-50 p-3 text-body text-red-700">{error}</p>}
      {loading ? <Spinner /> : tickets.length ? tickets.map((ticket) => {
        const { Icon, className } = ticketStatusStyles[ticket.status]
        return (
          <Link key={ticket.id} to={`/repairs/${ticket.id}`}>
            <Card className="flex min-h-touch items-center justify-between gap-3 hover:border-primary-700">
              <div className="min-w-0">
                <div className="mb-2 flex flex-wrap items-center gap-2">
                  <span className={`inline-flex min-h-8 items-center gap-1 rounded-full px-3 text-caption font-semibold ${className}`}><Icon aria-hidden="true" size={16} />{ticketStatusLabels[ticket.status]}</span>
                  <span className="text-caption text-text-muted">{ticketCategoryLabels[ticket.category]}</span>
                </div>
                <h2 className="break-words text-h2 font-bold text-text-heading">{ticket.title}</h2>
                <p className="mt-1 text-caption text-text-muted">{formatDateTH(ticket.created_at)}{ticket.house_no ? ` · บ้านเลขที่ ${ticket.house_no}` : ''}</p>
              </div>
              <ArrowRight aria-hidden="true" className="shrink-0 text-primary-700" size={22} />
            </Card>
          </Link>
        )
      }) : !error && <Card><EmptyState description="บอกเราได้เมื่อมีสิ่งที่ต้องการให้ช่วยดูแล" icon={Wrench} title="ยังไม่มีเรื่องที่แจ้ง" /></Card>}
    </div>
  )
}

export function TicketStatusBadge({ status }: { status: TicketStatus }) {
  const { Icon, className } = ticketStatusStyles[status]
  return <span className={`inline-flex min-h-8 items-center gap-1 rounded-full px-3 text-caption font-semibold ${className}`}><Icon aria-hidden="true" size={16} />{ticketStatusLabels[status]}</span>
}
