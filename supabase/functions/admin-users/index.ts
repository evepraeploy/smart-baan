import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.47.10'
import { identifierToEmail } from '../_shared/identifier.ts'
import { formatRecoveryCode, generateRecoveryCode } from '../_shared/recovery-code.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

type ActionBody =
  | { action: 'create_user'; identifier: string; display_name: string; phone?: string; role: 'resident' | 'committee' | 'admin'; house_no?: string; password: string }
  | { action: 'reset_password'; user_id: string; password: string }
  | { action: 'issue_recovery_code'; user_id: string }
  | { action: 'set_active'; user_id: string; is_active: boolean }

function response(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (request.method !== 'POST') return response({ error: 'INVALID_REQUEST' }, 405)

  const url = Deno.env.get('SUPABASE_URL')
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  const authorization = request.headers.get('Authorization')
  if (!url || !anonKey || !serviceRoleKey || !authorization) return response({ error: 'FORBIDDEN' }, 401)

  const authClient = createClient(url, anonKey, { global: { headers: { Authorization: authorization } } })
  const service = createClient(url, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } })
  const { data: userData, error: userError } = await authClient.auth.getUser()
  if (userError || !userData.user) return response({ error: 'FORBIDDEN' }, 401)

  const { data: adminRole, error: roleError } = await service
    .from('user_roles')
    .select('role,profiles!inner(is_active)')
    .eq('user_id', userData.user.id)
    .eq('role', 'admin')
    .maybeSingle()
  if (roleError || !adminRole || !(adminRole.profiles as { is_active: boolean }).is_active) {
    return response({ error: 'FORBIDDEN' }, 403)
  }

  let body: ActionBody
  try {
    const parsed: unknown = await request.json()
    if (typeof parsed !== 'object' || parsed === null || !('action' in parsed)) {
      return response({ error: 'INVALID_REQUEST' }, 400)
    }
    body = parsed as ActionBody
  } catch {
    return response({ error: 'INVALID_REQUEST' }, 400)
  }

  if (body.action === 'create_user') {
    if (
      typeof body.identifier !== 'string'
      || !body.identifier.trim()
      || typeof body.display_name !== 'string'
      || !body.display_name.trim()
      || typeof body.password !== 'string'
      || body.password.length < 8
      || (body.phone !== undefined && typeof body.phone !== 'string')
      || (body.house_no !== undefined && typeof body.house_no !== 'string')
      || !['resident', 'committee', 'admin'].includes(body.role)
    ) {
      return response({ error: 'INVALID_USER_DATA' }, 400)
    }
    const email = identifierToEmail(body.identifier)
    const { data: created, error: createError } = await service.auth.admin.createUser({
      email,
      password: body.password,
      email_confirm: true,
    })
    if (createError || !created.user) return response({ error: 'USER_CREATE_FAILED' }, 400)

    let houseId: string | null = null
    if (body.house_no) {
      const { data: house, error: houseError } = await service.from('houses').select('id').eq('house_no', body.house_no).maybeSingle()
      if (houseError || !house) {
        await service.auth.admin.deleteUser(created.user.id)
        return response({ error: 'HOUSE_NOT_FOUND' }, 400)
      }
      houseId = house.id
    }

    const { error: profileError } = await service.from('profiles').insert({
      id: created.user.id,
      display_name: body.display_name.trim(),
      phone: body.phone?.trim() || null,
      login_identifier: body.identifier.trim(),
      must_change_password: true,
    })
    if (profileError) {
      await service.auth.admin.deleteUser(created.user.id)
      return response({ error: 'PROFILE_CREATE_FAILED' }, 400)
    }
    const { error: roleInsertError } = await service.from('user_roles').insert({ user_id: created.user.id, role: body.role })
    if (roleInsertError) {
      await service.auth.admin.deleteUser(created.user.id)
      return response({ error: 'ROLE_CREATE_FAILED' }, 400)
    }
    if (houseId) {
      const { error: membershipError } = await service.from('house_members').insert({ house_id: houseId, user_id: created.user.id })
      if (membershipError) {
        await service.auth.admin.deleteUser(created.user.id)
        return response({ error: 'HOUSE_LINK_FAILED' }, 400)
      }
    }
    const recoveryCode = generateRecoveryCode()
    const { error: codeError } = await service.rpc('set_recovery_code', { p_user_id: created.user.id, p_code: recoveryCode })
    if (codeError) {
      await service.auth.admin.deleteUser(created.user.id)
      return response({ error: 'RECOVERY_CODE_ISSUE_FAILED' }, 400)
    }
    return response({ user_id: created.user.id, recovery_code: formatRecoveryCode(recoveryCode) })
  }

  if (body.action === 'issue_recovery_code') {
    if (typeof body.user_id !== 'string') return response({ error: 'INVALID_USER_DATA' }, 400)
    const { data: target, error: targetError } = await service.from('profiles').select('id').eq('id', body.user_id).maybeSingle()
    if (targetError || !target) return response({ error: 'USER_NOT_FOUND' }, 404)
    const recoveryCode = generateRecoveryCode()
    const { error: codeError } = await service.rpc('set_recovery_code', { p_user_id: target.id, p_code: recoveryCode })
    if (codeError) return response({ error: 'RECOVERY_CODE_ISSUE_FAILED' }, 400)
    return response({ recovery_code: formatRecoveryCode(recoveryCode) })
  }

  if (body.action === 'reset_password') {
    if (typeof body.user_id !== 'string' || typeof body.password !== 'string' || body.password.length < 8) {
      return response({ error: 'INVALID_PASSWORD' }, 400)
    }
    const { error: updateError } = await service.auth.admin.updateUserById(body.user_id, { password: body.password })
    if (updateError) return response({ error: 'PASSWORD_RESET_FAILED' }, 400)
    const { error: profileError } = await service.from('profiles').update({ must_change_password: true }).eq('id', body.user_id)
    if (profileError) return response({ error: 'PROFILE_UPDATE_FAILED' }, 400)
    return response({ success: true })
  }

  if (body.action === 'set_active') {
    if (typeof body.user_id !== 'string' || typeof body.is_active !== 'boolean') {
      return response({ error: 'INVALID_USER_DATA' }, 400)
    }
    const { error: updateError } = await service.from('profiles').update({ is_active: body.is_active }).eq('id', body.user_id)
    if (updateError) return response({ error: 'PROFILE_UPDATE_FAILED' }, 400)
    return response({ success: true })
  }

  return response({ error: 'INVALID_ACTION' }, 400)
})
