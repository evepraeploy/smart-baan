import { supabase } from '../../lib/supabase'
import { messages } from '../../lib/messages.th'

export type PendingSlip = {
  id: string
  house_id: string
  uploaded_by: string
  amount: number
  transferred_at: string
  file_path: string
  file_size: number | null
  status: 'pending'
  created_at: string
  house_no: string
  periods: string[]
  duplicate_count: number
  signed_url?: string
}

export async function listPendingSlips(): Promise<PendingSlip[]> {
  if (!supabase) throw new Error(messages.generic)
  const client = supabase
  const { data, error } = await client.rpc('list_pending_slips')
  if (error) throw error
  const rows = (data ?? []) as unknown as PendingSlip[]
  return Promise.all(rows.map(async (row) => {
    const { data: signed, error: signedError } = await client.storage.from('slips').createSignedUrl(row.file_path, 600)
    return { ...row, signed_url: signedError ? undefined : signed?.signedUrl }
  }))
}

export async function approveSlip(id: string) {
  if (!supabase) throw new Error(messages.generic)
  const { error } = await supabase.rpc('approve_slip', { p_slip_id: id })
  if (error) throw error
}

export async function rejectSlip(id: string, reason: string) {
  if (!supabase) throw new Error(messages.generic)
  const { error } = await supabase.rpc('reject_slip', { p_slip_id: id, p_reason: reason })
  if (error) throw error
}
