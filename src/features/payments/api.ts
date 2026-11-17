import { supabase } from '../../lib/supabase'
import { messages } from '../../lib/messages.th'

export type Bill = {
  id: string
  house_id: string
  period: string
  amount: number
  due_date: string
  status: 'unpaid' | 'pending_review' | 'paid' | 'waived'
  paid_at: string | null
}

export async function getHouseBills(houseId: string): Promise<Bill[]> {
  if (!supabase) throw new Error(messages.generic)
  const { data, error } = await supabase
    .from('bills')
    .select('id,house_id,period,amount,due_date,status,paid_at')
    .eq('house_id', houseId)
    .order('period', { ascending: false })
  if (error) throw error
  return (data ?? []) as Bill[]
}

export async function submitSlip(input: {
  billIds: string[]
  amount: number
  transferredAt: string
  filePath: string
  fileSize: number
}): Promise<string> {
  if (!supabase) throw new Error(messages.generic)
  const { data, error } = await supabase.rpc('submit_slip', {
    p_bill_ids: input.billIds,
    p_amount: input.amount,
    p_transferred_at: input.transferredAt,
    p_file_path: input.filePath,
    p_file_size: input.fileSize,
  })
  if (error) throw error
  return data as string
}
