import { supabase } from '../../lib/supabase'
import { messages } from '../../lib/messages.th'

export type ManagedHouse = {
  id: string
  house_no: string
  soi: string | null
  owner_name: string | null
  is_active: boolean
  house_members: { profiles: { id: string; display_name: string; phone: string | null; is_active: boolean; user_roles: { role: string }[] } | null }[]
}

export type NewUser = {
  identifier: string
  display_name: string
  phone?: string
  role: 'resident' | 'committee' | 'admin'
  house_no?: string
  password: string
}

export type PasswordResetRequest = {
  id: string
  user_id: string
  display_name: string
  login_identifier: string
  phone: string | null
  house_no: string | null
  contact_phone: string | null
  note: string | null
  created_at: string
}

export async function getHouses(): Promise<ManagedHouse[]> {
  if (!supabase) throw new Error(messages.generic)
  const { data, error } = await supabase.from('houses')
    .select('id,house_no,soi,owner_name,is_active,house_members(profiles(id,display_name,phone,is_active,user_roles(role)))')
    .order('house_no')
  if (error) throw error
  return (data ?? []) as unknown as ManagedHouse[]
}

export async function listPasswordResetRequests(): Promise<PasswordResetRequest[]> {
  if (!supabase) throw new Error(messages.generic)
  const { data, error } = await supabase.rpc('list_password_reset_requests')
  if (error) throw error
  return (data ?? []) as PasswordResetRequest[]
}

export async function closePasswordResetRequest(id: string, status: 'resolved' | 'dismissed'): Promise<void> {
  if (!supabase) throw new Error(messages.generic)
  const { error } = await supabase.rpc('close_password_reset_request', {
    p_request_id: id,
    p_status: status,
  })
  if (error) throw error
}

export async function adminUserAction<T>(body: Record<string, unknown>): Promise<T> {
  if (!supabase) throw new Error(messages.generic)
  const { data, error } = await supabase.functions.invoke('admin-users', { body })
  if (error) throw error
  if (data?.error) throw new Error(String(data.error))
  return data as T
}
