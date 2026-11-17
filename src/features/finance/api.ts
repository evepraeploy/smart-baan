import { supabase } from '../../lib/supabase'
import { messages } from '../../lib/messages.th'

export type LedgerType = 'income' | 'expense'
export type LedgerInput = {
  entry_type: LedgerType
  category: string
  amount: number
  entry_date: string
  description: string | null
  attachment_path: string | null
}
export type LedgerEntry = LedgerInput & {
  id: string
  house_id: string | null
  slip_id: string | null
  created_at: string
  house_no: string | null
  signed_url?: string
}
export type FinanceMonth = { month: string; income: number; expense: number }
export type FinanceCategory = { entry_type: LedgerType; category: string; amount: number }
export type FinanceReport = {
  opening_balance: number
  opening_balance_date: string | null
  total_income: number
  total_expense: number
  balance: number
  year_income: number
  year_expense: number
  months: FinanceMonth[]
  categories: FinanceCategory[]
}

export async function listLedgerEntries(month: string): Promise<LedgerEntry[]> {
  if (!supabase) throw new Error(messages.generic)
  const [year, monthNumber] = month.split('-').map(Number)
  const fromDate = `${month}-01`
  const toDate = new Date(Date.UTC(year, monthNumber, 1)).toISOString().slice(0, 10)
  const client = supabase
  const { data, error } = await client.from('ledger_entries')
    .select('id,entry_type,category,amount,entry_date,description,attachment_path,house_id,slip_id,created_at,houses(house_no)')
    .gte('entry_date', fromDate)
    .lt('entry_date', toDate)
    .order('entry_date', { ascending: false })
    .order('created_at', { ascending: false })
  if (error) throw error

  const rows = (data ?? []) as unknown as (Omit<LedgerEntry, 'house_no' | 'signed_url'> & {
    houses: { house_no: string } | null
  })[]
  return Promise.all(rows.map(async (row) => {
    const { data: signed, error: signedError } = row.attachment_path
      ? await client.storage.from('receipts').createSignedUrl(row.attachment_path, 600)
      : { data: null, error: null }
    return {
      ...row,
      house_no: row.houses?.house_no ?? null,
      signed_url: signedError ? undefined : signed?.signedUrl,
    }
  }))
}

export async function createLedgerEntry(input: LedgerInput): Promise<string> {
  if (!supabase) throw new Error(messages.generic)
  const { data, error } = await supabase.rpc('create_ledger_entry', {
    p_entry_type: input.entry_type,
    p_category: input.category,
    p_amount: input.amount,
    p_entry_date: input.entry_date,
    p_description: input.description,
    p_attachment_path: input.attachment_path,
  })
  if (error) throw error
  return data as string
}

export async function updateLedgerEntry(id: string, input: LedgerInput): Promise<void> {
  if (!supabase) throw new Error(messages.generic)
  const { error } = await supabase.rpc('update_ledger_entry', {
    p_id: id,
    p_entry_type: input.entry_type,
    p_category: input.category,
    p_amount: input.amount,
    p_entry_date: input.entry_date,
    p_description: input.description,
    p_attachment_path: input.attachment_path,
  })
  if (error) throw error
}

export async function deleteLedgerEntry(id: string): Promise<void> {
  if (!supabase) throw new Error(messages.generic)
  const { error } = await supabase.rpc('delete_ledger_entry', { p_id: id })
  if (error) throw error
}

export async function uploadLedgerReceipt(file: File, ext: 'webp' | 'jpg'): Promise<string> {
  if (!supabase) throw new Error(messages.generic)
  const path = `ledger/${crypto.randomUUID()}.${ext}`
  const { error } = await supabase.storage.from('receipts').upload(path, file, {
    contentType: ext === 'webp' ? 'image/webp' : 'image/jpeg',
    upsert: false,
  })
  if (error) throw error
  return path
}

export async function getFinanceReport(year: number): Promise<FinanceReport> {
  if (!supabase) throw new Error(messages.generic)
  const { data, error } = await supabase.rpc('get_finance_report', { p_year: year })
  if (error) throw error
  return data as FinanceReport
}
