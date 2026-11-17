import { supabase } from '../../lib/supabase'
import { messages } from '../../lib/messages.th'

export type Announcement = {
  id: string
  title: string
  body: string
  image_path: string | null
  is_pinned: boolean
  expires_at: string | null
  created_by: string
  created_at: string
  updated_at: string
  is_read: boolean
  signed_url?: string
}

export type AnnouncementInput = {
  title: string
  body: string
  image_path: string | null
  is_pinned: boolean
  expires_at: string | null
}

export async function listAnnouncements(userId: string): Promise<Announcement[]> {
  if (!supabase) throw new Error(messages.generic)
  const client = supabase
  const { data, error } = await client.from('announcements')
    .select('id,title,body,image_path,is_pinned,expires_at,created_by,created_at,updated_at')
    .order('is_pinned', { ascending: false })
    .order('created_at', { ascending: false })
  if (error) throw error
  const rows = (data ?? []) as unknown as Omit<Announcement, 'is_read' | 'signed_url'>[]
  const ids = rows.map((row) => row.id)
  const { data: reads, error: readError } = ids.length
    ? await client.from('announcement_reads').select('announcement_id').eq('user_id', userId).in('announcement_id', ids)
    : { data: [], error: null }
  if (readError) throw readError
  const readIds = new Set((reads ?? []).map((read) => read.announcement_id as string))

  return Promise.all(rows.map(async (row) => {
    const { data: signed, error: signedError } = row.image_path
      ? await client.storage.from('announcements').createSignedUrl(row.image_path, 600)
      : { data: null, error: null }
    return {
      ...row,
      is_read: readIds.has(row.id),
      signed_url: signedError ? undefined : signed?.signedUrl,
    }
  }))
}

export async function saveAnnouncement(id: string | null, input: AnnouncementInput): Promise<void> {
  if (!supabase) throw new Error(messages.generic)
  const result = id
    ? await supabase.from('announcements').update(input).eq('id', id)
    : await supabase.from('announcements').insert(input)
  if (result.error) throw result.error
}

export async function deleteAnnouncement(id: string, imagePath: string | null): Promise<void> {
  if (!supabase) throw new Error(messages.generic)
  const { error } = await supabase.from('announcements').delete().eq('id', id)
  if (error) throw error
  if (imagePath) await supabase.storage.from('announcements').remove([imagePath])
}

export async function uploadAnnouncementImage(file: File, ext: 'webp' | 'jpg'): Promise<string> {
  if (!supabase) throw new Error(messages.generic)
  const path = `announcements/${crypto.randomUUID()}.${ext}`
  const { error } = await supabase.storage.from('announcements').upload(path, file, {
    contentType: ext === 'webp' ? 'image/webp' : 'image/jpeg',
    upsert: false,
  })
  if (error) throw error
  return path
}

export async function removeAnnouncementImage(path: string): Promise<void> {
  if (!supabase) throw new Error(messages.generic)
  const { error } = await supabase.storage.from('announcements').remove([path])
  if (error) throw error
}

export async function markAnnouncementsRead(ids: string[], userId: string): Promise<void> {
  if (!supabase || !ids.length) return
  const { error } = await supabase.from('announcement_reads').upsert(
    ids.map((announcement_id) => ({ announcement_id, user_id: userId })),
    { onConflict: 'announcement_id,user_id', ignoreDuplicates: true },
  )
  if (error) throw error
  window.dispatchEvent(new Event('announcement-reads-updated'))
}

export async function countUnreadAnnouncements(userId: string): Promise<number> {
  if (!supabase) return 0
  const client = supabase
  const { data, error } = await client.from('announcements').select('id')
  if (error) throw error
  const ids = (data ?? []).map((row) => row.id as string)
  if (!ids.length) return 0
  const { data: reads, error: readError } = await client.from('announcement_reads')
    .select('announcement_id')
    .eq('user_id', userId)
    .in('announcement_id', ids)
  if (readError) throw readError
  return ids.length - (reads ?? []).length
}
