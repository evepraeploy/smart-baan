import { supabase } from '../../lib/supabase'
import { messages } from '../../lib/messages.th'
import { getBangkokMonthUtcBounds } from '../../lib/date'
import { signSlipUrls, type SlipRecord } from '../payments/slipsApi'

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

export type ReviewedSlip = SlipRecord & {
  house_no: string
  periods: string[]
  reviewed_at: string | null
}

export async function listReviewedSlips(month: string): Promise<ReviewedSlip[]> {
  if (!supabase) throw new Error(messages.generic)
  const { start, end } = getBangkokMonthUtcBounds(month)
  const { data, error } = await supabase.from('slips')
    .select('id,status,reject_reason,amount,transferred_at,created_at,file_path,reviewed_at,houses(house_no),slip_bills(bills(period))')
    .in('status', ['approved', 'rejected'])
    .gte('created_at', start)
    .lt('created_at', end)
    .order('created_at', { ascending: false })
  if (error) throw error

  const rows = (data ?? []) as unknown as {
    id: string
    status: SlipRecord['status']
    reject_reason: string | null
    amount: number
    transferred_at: string
    created_at: string
    file_path: string
    reviewed_at: string | null
    houses: { house_no: string } | null
    slip_bills: { bills: { period: string } | null }[] | null
  }[]
  const records = rows.map((row) => ({
    slip: {
      id: row.id,
      status: row.status,
      reject_reason: row.reject_reason,
      amount: row.amount,
      transferred_at: row.transferred_at,
      created_at: row.created_at,
      file_path: row.file_path,
    } satisfies SlipRecord,
    house_no: row.houses?.house_no ?? '—',
    periods: Array.from(new Set((row.slip_bills ?? [])
      .map((link) => link.bills?.period)
      .filter((period): period is string => Boolean(period))))
      .sort((a, b) => b.localeCompare(a)),
    reviewed_at: row.reviewed_at,
  }))
  const signed = await signSlipUrls(records.map((record) => record.slip))
  return records.map((record, index) => ({ ...signed[index], house_no: record.house_no, periods: record.periods, reviewed_at: record.reviewed_at }))
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
