import { supabase } from '../../lib/supabase'
import { messages } from '../../lib/messages.th'

export type SlipStatus = 'pending' | 'approved' | 'rejected'

export type SlipRecord = {
  id: string
  status: SlipStatus
  reject_reason: string | null
  amount: number
  transferred_at: string
  created_at: string
  file_path: string
  thumb_url?: string
}

export type BillWithSlips = {
  id: string
  period: string
  amount: number
  due_date: string
  status: 'unpaid' | 'pending_review' | 'paid' | 'waived'
  house_no?: string
  slips: SlipRecord[]
}

export async function signSlipUrls(records: SlipRecord[]): Promise<SlipRecord[]> {
  if (!records.length) return []
  if (!supabase) throw new Error(messages.generic)

  const { data, error } = await supabase.storage.from('slips')
    .createSignedUrls(records.map((record) => record.file_path), 600)
  if (error) throw error

  const urlsByPath = new Map((data ?? []).map((item) => [item.path, item.signedUrl ?? undefined]))
  return records.map((record) => ({ ...record, thumb_url: urlsByPath.get(record.file_path) }))
}

export async function getFreshSlipUrl(path: string): Promise<string> {
  if (!supabase) throw new Error(messages.generic)
  const { data, error } = await supabase.storage.from('slips').createSignedUrl(path, 600)
  if (error) throw error
  if (!data?.signedUrl) throw new Error(messages.generic)
  return data.signedUrl
}

export async function getBillWithSlips(billId: string): Promise<BillWithSlips> {
  if (!supabase) throw new Error(messages.generic)
  const { data, error } = await supabase.from('bills')
    .select('id,period,amount,due_date,status,houses(house_no),slip_bills(slips(id,status,reject_reason,amount,transferred_at,created_at,file_path))')
    .eq('id', billId)
    .single()
  if (error) throw error

  const bill = data as unknown as {
    id: string
    period: string
    amount: number
    due_date: string
    status: BillWithSlips['status']
    houses: { house_no: string } | null
    slip_bills: { slips: SlipRecord | null }[] | null
  }
  const slips = (bill.slip_bills ?? [])
    .map((link) => link.slips)
    .filter((slip): slip is SlipRecord => Boolean(slip))
    .sort((a, b) => b.created_at.localeCompare(a.created_at))

  return {
    id: bill.id,
    period: bill.period,
    amount: bill.amount,
    due_date: bill.due_date,
    status: bill.status,
    house_no: bill.houses?.house_no,
    slips: await signSlipUrls(slips),
  }
}
