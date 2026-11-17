import { supabase } from '../../lib/supabase'
import { messages } from '../../lib/messages.th'

export type PaymentStatusHouse = { id: string; house_no: string }
export type PaymentStatusBill = {
  house_id: string
  house_no: string
  period: string
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
      .select('house_id,period,due_date,status,houses(house_no)')
      .gte('period', `${year}-01-01`)
      .lt('period', `${nextYear}-01-01`)
      .order('period'),
  ])
  if (housesResult.error) throw housesResult.error
  if (billsResult.error) throw billsResult.error
  const bills = (billsResult.data ?? []) as unknown as {
    house_id: string
    period: string
    due_date: string
    status: PaymentStatusBill['status']
    houses: { house_no: string } | null
  }[]
  return {
    houses: (housesResult.data ?? []) as PaymentStatusHouse[],
    bills: bills.map((bill) => ({
      house_id: bill.house_id,
      house_no: bill.houses?.house_no ?? '',
      period: bill.period,
      due_date: bill.due_date,
      status: bill.status,
    })),
  }
}
