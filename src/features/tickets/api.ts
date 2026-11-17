import { supabase } from '../../lib/supabase'
import { messages } from '../../lib/messages.th'

export type TicketStatus = 'pending' | 'in_progress' | 'done' | 'rejected'
export type TicketCategory = 'electric' | 'plumbing' | 'road' | 'cleaning' | 'security' | 'other'
export type TicketInput = { category: TicketCategory; title: string; description: string }
export type Ticket = {
  id: string
  house_id: string | null
  reporter_id: string
  category: TicketCategory
  title: string
  description: string
  status: TicketStatus
  assignee_id: string | null
  contractor_name: string | null
  created_at: string
  updated_at: string
  closed_at: string | null
  house_no: string | null
}
export type TicketPhoto = { id: string; ticket_id: string; path: string; kind: 'report' | 'after'; created_at: string; signed_url?: string }
export type TicketEvent = {
  id: number
  ticket_id: string
  actor_id: string | null
  actor_name: string
  event_type: 'created' | 'status' | 'assigned' | 'comment' | 'photo' | 'expense'
  from_status: TicketStatus | null
  to_status: TicketStatus | null
  comment: string | null
  created_at: string
}
export type TicketDetails = {
  ticket: Ticket
  photos: TicketPhoto[]
  events: TicketEvent[]
  job: TicketJob | null
  linkedAsset: { id: string; name: string } | null
}
export type TicketJob = {
  ticket_id: string
  contractor_id: string | null
  appointment_at: string | null
  fee: number | null
  ledger_entry_id: string | null
  contractor: { id: string; name: string; phone: string | null; trade: string | null } | null
}
export type Contractor = { id: string; name: string; phone: string | null; trade: string | null; note: string | null; is_active: boolean }
export type CommitteeMember = { id: string; display_name: string }

type JoinedTicket = Omit<Ticket, 'house_no'> & { houses: { house_no: string } | null }

function requireSupabase() {
  if (!supabase) throw new Error(messages.generic)
  return supabase
}

function mapTicket(row: JoinedTicket): Ticket {
  const { houses, ...ticket } = row
  return { ...ticket, house_no: houses?.house_no ?? null }
}

export async function listMyTickets(userId: string, houseId: string | null): Promise<Ticket[]> {
  const client = requireSupabase()
  let query = client.from('tickets')
    .select('id,house_id,reporter_id,category,title,description,status,assignee_id,contractor_name,created_at,updated_at,closed_at,houses(house_no)')
    .order('created_at', { ascending: false })
  const predicates = [`reporter_id.eq.${userId}`]
  if (houseId) predicates.push(`house_id.eq.${houseId}`)
  query = query.or(predicates.join(','))
  const { data, error } = await query
  if (error) throw error
  return ((data ?? []) as unknown as JoinedTicket[]).map(mapTicket)
}

export async function listMaintenanceTickets(): Promise<Ticket[]> {
  const { data, error } = await requireSupabase().from('tickets')
    .select('id,house_id,reporter_id,category,title,description,status,assignee_id,contractor_name,created_at,updated_at,closed_at,houses(house_no)')
    .order('created_at', { ascending: true })
  if (error) throw error
  return ((data ?? []) as unknown as JoinedTicket[]).map(mapTicket)
}

export async function getTicket(id: string, userId: string, committee: boolean): Promise<TicketDetails> {
  const client = requireSupabase()
  const ticketSelect = committee
    ? 'id,house_id,reporter_id,category,title,description,status,assignee_id,contractor_name,created_at,updated_at,closed_at,asset_id,assets(id,name),houses(house_no)'
    : 'id,house_id,reporter_id,category,title,description,status,assignee_id,contractor_name,created_at,updated_at,closed_at,houses(house_no)'
  const { data: ticketData, error: ticketError } = await client.from('tickets')
    .select(ticketSelect)
    .eq('id', id)
    .maybeSingle()
  if (ticketError) throw ticketError
  if (!ticketData) throw new Error(messages.ticketNotFound)
  const ticket = mapTicket(ticketData as unknown as JoinedTicket)
  const linkedAsset = committee
    ? ((ticketData as unknown as { assets: { id: string; name: string } | null }).assets ?? null)
    : null
  const eventSelect = committee
    ? 'id,ticket_id,actor_id,event_type,from_status,to_status,comment,created_at,profiles(display_name)'
    : 'id,ticket_id,actor_id,event_type,from_status,to_status,comment,created_at'
  const [photoResult, eventResult, jobResult] = await Promise.all([
    client.from('ticket_photos').select('id,ticket_id,path,kind,created_at').eq('ticket_id', id).order('created_at'),
    client.from('ticket_events').select(eventSelect).eq('ticket_id', id).order('created_at'),
    committee
      ? client.from('ticket_jobs').select('ticket_id,contractor_id,appointment_at,fee,ledger_entry_id,contractors(id,name,phone,trade)').eq('ticket_id', id).maybeSingle()
      : Promise.resolve({ data: null, error: null }),
  ])
  if (photoResult.error) throw photoResult.error
  if (eventResult.error) throw eventResult.error
  if (jobResult.error) throw jobResult.error
  const photoRows = (photoResult.data ?? []) as unknown as Omit<TicketPhoto, 'signed_url'>[]
  const photos = await Promise.all(photoRows.map(async (photo) => {
    const { data, error } = await client.storage.from('tickets').createSignedUrl(photo.path, 600)
    return { ...photo, signed_url: error ? undefined : data?.signedUrl }
  }))
  const events = ((eventResult.data ?? []) as unknown as {
    id: number
    ticket_id: string
    actor_id: string | null
    event_type: TicketEvent['event_type']
    from_status: TicketStatus | null
    to_status: TicketStatus | null
    comment: string | null
    created_at: string
    profiles?: { display_name: string } | null
  }[]).map((event) => ({
    ...event,
    actor_name: committee ? event.profiles?.display_name ?? 'กรรมการ' : event.actor_id === userId ? 'คุณ' : 'กรรมการ',
  }))
  const rawJob = jobResult.data as unknown as (Omit<TicketJob, 'contractor'> & {
    contractors: TicketJob['contractor']
  }) | null
  return {
    ticket,
    photos,
    events,
    linkedAsset,
    job: rawJob ? {
      ticket_id: rawJob.ticket_id,
      contractor_id: rawJob.contractor_id,
      appointment_at: rawJob.appointment_at,
      fee: rawJob.fee,
      ledger_entry_id: rawJob.ledger_entry_id,
      contractor: rawJob.contractors,
    } : null,
  }
}

export async function linkTicketAsset(ticketId: string, assetId: string | null): Promise<void> {
  const { error } = await requireSupabase().rpc('link_ticket_asset', {
    p_ticket_id: ticketId,
    p_asset_id: assetId,
  })
  if (error) throw error
}

export async function createTicket(input: TicketInput): Promise<string> {
  const { data, error } = await requireSupabase().rpc('create_ticket', {
    p_category: input.category,
    p_title: input.title,
    p_description: input.description,
  })
  if (error) throw error
  return data as string
}

export async function uploadTicketPhoto(ticketId: string, file: File, ext: 'webp' | 'jpg'): Promise<string> {
  const client = requireSupabase()
  const path = `${ticketId}/${crypto.randomUUID()}.${ext}`
  const { error } = await client.storage.from('tickets').upload(path, file, {
    contentType: ext === 'webp' ? 'image/webp' : 'image/jpeg',
    upsert: false,
  })
  if (error) throw error
  return path
}

export async function addTicketPhotos(ticketId: string, kind: 'report' | 'after', paths: string[]): Promise<void> {
  const { error } = await requireSupabase().rpc('add_ticket_photos', {
    p_ticket_id: ticketId,
    p_kind: kind,
    p_paths: paths,
  })
  if (error) throw error
}

export async function updateTicketStatus(id: string, status: TicketStatus, comment: string | null, recordExpense = false): Promise<void> {
  const { error } = await requireSupabase().rpc('update_ticket_status', {
    p_ticket_id: id,
    p_status: status,
    p_comment: comment,
    p_record_expense: recordExpense,
  })
  if (error) throw error
}

export async function assignTicket(input: {
  id: string
  assigneeId: string | null
  contractorId: string | null
  appointmentAt: string | null
  fee: number | null
}): Promise<void> {
  const { error } = await requireSupabase().rpc('assign_ticket', {
    p_ticket_id: input.id,
    p_assignee_id: input.assigneeId,
    p_contractor_id: input.contractorId,
    p_appointment_at: input.appointmentAt,
    p_fee: input.fee,
  })
  if (error) throw error
}

export async function addTicketComment(id: string, comment: string): Promise<void> {
  const { error } = await requireSupabase().rpc('add_ticket_comment', { p_ticket_id: id, p_comment: comment })
  if (error) throw error
}

export async function listCommitteeMembers(): Promise<CommitteeMember[]> {
  const { data, error } = await requireSupabase().rpc('list_committee_members')
  if (error) throw error
  return (data ?? []) as CommitteeMember[]
}

export async function listContractors(activeOnly = false): Promise<Contractor[]> {
  let query = requireSupabase().from('contractors').select('id,name,phone,trade,note,is_active').order('name')
  if (activeOnly) query = query.eq('is_active', true)
  const { data, error } = await query
  if (error) throw error
  return (data ?? []) as Contractor[]
}

export async function saveContractor(id: string | null, input: Omit<Contractor, 'id'>): Promise<string | null> {
  const client = requireSupabase()
  if (id) {
    const { error } = await client.from('contractors').update(input).eq('id', id)
    if (error) throw error
    return id
  }
  const { data, error } = await client.from('contractors').insert(input).select('id').single()
  if (error) throw error
  return data.id
}

export async function countOpenTickets(): Promise<number> {
  const { count, error } = await requireSupabase().from('tickets')
    .select('id', { count: 'exact', head: true })
    .in('status', ['pending', 'in_progress'])
  if (error) throw error
  return count ?? 0
}
