import { supabase } from '../../lib/supabase'
import { messages } from '../../lib/messages.th'

export type AssetStatus = 'active' | 'repair' | 'retired'
export type MaintenanceKind = 'pm' | 'repair'
export type Asset = {
  id: string
  name: string
  category: string | null
  location: string | null
  installed_on: string | null
  image_path: string | null
  status: AssetStatus
  pm_interval_days: number | null
  last_maintained_on: string | null
  next_due_date: string | null
  note: string | null
  created_at: string
  updated_at: string
  signed_url?: string
}
export type MaintenanceLog = {
  id: string
  asset_id: string
  performed_on: string
  kind: MaintenanceKind
  description: string
  contractor_id: string | null
  cost: number | null
  ledger_entry_id: string | null
  ticket_id: string | null
  created_by: string | null
  created_at: string
  contractor_name: string | null
  ticket_title: string | null
}
export type MaintenanceInput = {
  asset_id: string
  performed_on: string
  kind: MaintenanceKind
  description: string
  contractor_id: string | null
  cost: number | null
  record_expense: boolean
  ticket_id: string | null
}
export type CommitteeDashboard = {
  balance: number
  month_income: number
  month_expense: number
  pending_slips: number
  open_tickets: number
  tickets_by_status: { pending: number; in_progress: number }
  pm_overdue: { id: string; name: string; next_due_date: string }[]
  pm_due_soon: { id: string; name: string; next_due_date: string }[]
  bills_this_month: { paid: number; pending_review: number; unpaid: number }
}

function requireSupabase() {
  if (!supabase) throw new Error(messages.generic)
  return supabase
}

export async function listAssets(): Promise<Asset[]> {
  const client = requireSupabase()
  const { data, error } = await client.from('assets')
    .select('id,name,category,location,installed_on,image_path,status,pm_interval_days,last_maintained_on,next_due_date,note,created_at,updated_at')
    .order('name')
  if (error) throw error
  return Promise.all(((data ?? []) as Asset[]).map(async (asset) => {
    if (!asset.image_path) return asset
    const { data: signed, error: signedError } = await client.storage.from('assets').createSignedUrl(asset.image_path, 600)
    return { ...asset, signed_url: signedError ? undefined : signed?.signedUrl }
  }))
}

export async function getAsset(id: string): Promise<{ asset: Asset; logs: MaintenanceLog[] }> {
  const client = requireSupabase()
  const { data: row, error } = await client.from('assets')
    .select('id,name,category,location,installed_on,image_path,status,pm_interval_days,last_maintained_on,next_due_date,note,created_at,updated_at')
    .eq('id', id)
    .maybeSingle()
  if (error) throw error
  if (!row) throw new Error(messages.assetNotFound)
  const asset = row as Asset
  let signedUrl: string | undefined
  if (asset.image_path) {
    const { data, error: signedError } = await client.storage.from('assets').createSignedUrl(asset.image_path, 600)
    if (!signedError) signedUrl = data?.signedUrl
  }
  const { data: logRows, error: logsError } = await client.from('maintenance_logs')
    .select('id,asset_id,performed_on,kind,description,contractor_id,cost,ledger_entry_id,ticket_id,created_by,created_at,contractors(name),tickets(title)')
    .eq('asset_id', id)
    .order('performed_on', { ascending: false })
  if (logsError) throw logsError
  const logs = (logRows ?? []) as unknown as (Omit<MaintenanceLog, 'contractor_name' | 'ticket_title'> & {
    contractors: { name: string } | null
    tickets: { title: string } | null
  })[]
  return {
    asset: { ...asset, signed_url: signedUrl },
    logs: logs.map(({ contractors, tickets, ...log }) => ({
      ...log,
      contractor_name: contractors?.name ?? null,
      ticket_title: tickets?.title ?? null,
    })),
  }
}

export async function saveAsset(id: string | null, input: Omit<Asset, 'id' | 'created_at' | 'updated_at' | 'signed_url'>): Promise<string> {
  const client = requireSupabase()
  if (id) {
    const { error } = await client.from('assets').update(input).eq('id', id)
    if (error) throw error
    return id
  }
  const { data, error } = await client.from('assets').insert(input).select('id').single()
  if (error) throw error
  return data.id
}

export async function uploadAssetImage(file: File, ext: 'webp' | 'jpg'): Promise<string> {
  const path = `assets/${crypto.randomUUID()}.${ext}`
  const { error } = await requireSupabase().storage.from('assets').upload(path, file, {
    contentType: ext === 'webp' ? 'image/webp' : 'image/jpeg',
    upsert: false,
  })
  if (error) throw error
  return path
}

export async function recordMaintenance(input: MaintenanceInput): Promise<string> {
  const { data, error } = await requireSupabase().rpc('record_maintenance', {
    p_asset_id: input.asset_id,
    p_performed_on: input.performed_on,
    p_kind: input.kind,
    p_description: input.description,
    p_contractor_id: input.contractor_id,
    p_cost: input.cost,
    p_record_expense: input.record_expense,
    p_ticket_id: input.ticket_id,
  })
  if (error) throw error
  return data as string
}

export async function listTicketsForAsset(assetId: string): Promise<{ id: string; title: string; status: string }[]> {
  const { data, error } = await requireSupabase().from('tickets')
    .select('id,title,status')
    .eq('asset_id', assetId)
    .order('created_at', { ascending: false })
  if (error) throw error
  return (data ?? []) as { id: string; title: string; status: string }[]
}

export async function getCommitteeDashboard(): Promise<CommitteeDashboard> {
  const { data, error } = await requireSupabase().rpc('get_committee_dashboard')
  if (error) throw error
  return data as CommitteeDashboard
}
