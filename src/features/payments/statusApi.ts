import { supabase } from '../../lib/supabase'
import { messages } from '../../lib/messages.th'
import { compareHouseNo } from '../../lib/house-number'

export type PaymentStatusHouse = { id: string; house_no: string }
export type VillagePaymentSummary = {
  total: number
  paid: number
  pending_review: number
  unpaid: number
  my_status: 'paid' | 'pending_review' | 'unpaid' | null
}
export type MonthPaymentStatus = { house_no: string; state: 'paid' | 'pending' | 'unpaid' }
export type PaymentStatusBill = {
  id: string
  house_id: string
  house_no: string
  period: string
  amount: number
  due_date: string
  status: 'unpaid' | 'pending_review' | 'paid' | 'waived'
}

export async function getPaymentStatusData(year: number): Promise<{
  houses: PaymentStatusHouse[]
  bills: PaymentStatusBill[]
}> {
  if (!supabase) throw new Error(messages.generic)
  const nextYear = year + 1
  const [housesResult, billsResult] = await Promise.all([
    supabase.from('houses').select('id,house_no').eq('is_active', true).order('house_no'),
    supabase.from('bills')
      .select('id,house_id,period,amount,due_date,status,houses(house_no)')
      .gte('period', `${year}-01-01`)
      .lt('period', `${nextYear}-01-01`)
      .order('period'),
  ])
  if (housesResult.error) throw housesResult.error
  if (billsResult.error) throw billsResult.error
  const bills = (billsResult.data ?? []) as unknown as {
    house_id: string
    id: string
    period: string
    amount: number
    due_date: string
    status: PaymentStatusBill['status']
    houses: { house_no: string } | null
  }[]
  return {
    houses: (housesResult.data ?? []) as PaymentStatusHouse[],
    bills: bills.map((bill) => ({
      id: bill.id,
      house_id: bill.house_id,
      house_no: bill.houses?.house_no ?? '',
      period: bill.period,
      amount: bill.amount,
      due_date: bill.due_date,
      status: bill.status,
    })),
  }
}

export async function getVillagePaymentSummary(period: string): Promise<VillagePaymentSummary> {
  if (!supabase) throw new Error(messages.generic)
  const { data, error } = await supabase.rpc('get_village_payment_summary', { p_period: period })
  if (error) throw error
  return data as VillagePaymentSummary
}

export async function getMonthPaymentStatus(period: string): Promise<MonthPaymentStatus[]> {
  if (!supabase) throw new Error(messages.generic)
  const [housesResult, billsResult] = await Promise.all([
    supabase.from('houses').select('id,house_no').eq('is_active', true).order('house_no'),
    supabase.from('bills').select('house_id,status').eq('period', period),
  ])
  if (housesResult.error) throw housesResult.error
  if (billsResult.error) throw billsResult.error

  const statusByHouse = new Map((billsResult.data ?? []).map((bill) => [bill.house_id, bill.status]))
  return ((housesResult.data ?? []) as PaymentStatusHouse[])
    .map(({ id, house_no }) => {
      const status = statusByHouse.get(id)
      return {
        house_no,
        state: status === 'paid' || status === 'waived'
          ? 'paid'
          : status === 'pending_review' ? 'pending' : 'unpaid',
      } satisfies MonthPaymentStatus
    })
    .sort((a, b) => compareHouseNo(a.house_no, b.house_no))
}
