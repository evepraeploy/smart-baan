import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.47.10'
import { formatRecoveryCode, generateRecoveryCode, normalizeRecoveryCode, recoveryVerificationError } from '../_shared/recovery-code.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function response(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (request.method !== 'POST') return response({ error: 'INVALID_REQUEST' }, 405)
  const url = Deno.env.get('SUPABASE_URL')
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!url || !anonKey || !serviceKey || request.headers.get('apikey') !== anonKey) return response({ error: 'INVALID_REQUEST' }, 400)

  let body: { identifier?: unknown; code?: unknown; new_password?: unknown }
  try { body = await request.json() }
  catch { return response({ error: 'INVALID_REQUEST' }, 400) }
  if (typeof body.identifier !== 'string' || typeof body.code !== 'string') return response({ error: 'RECOVERY_INVALID' }, 400)
  if (typeof body.new_password !== 'string' || body.new_password.length < 8) return response({ error: 'INVALID_PASSWORD' }, 400)
  const code = normalizeRecoveryCode(body.code)
  if (!code) return response({ error: 'RECOVERY_INVALID' }, 400)

  const service = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } })
  const { data: userId, error: verifyError } = await service.rpc('verify_recovery_code', {
    p_identifier: body.identifier.trim(),
    p_code: code,
  })
  if (verifyError?.message.includes('RECOVERY_LOCKED')) return response({ error: 'RECOVERY_LOCKED' }, 429)
  if (verifyError) return response({ error: 'RECOVERY_UNAVAILABLE' }, 503)
  const verifiedUserId = typeof userId === 'string' && userId ? userId : null
  if (!verifiedUserId) return response({ error: recoveryVerificationError(verifiedUserId) }, 400)

  const { error: passwordError } = await service.auth.admin.updateUserById(verifiedUserId, { password: body.new_password })
  if (passwordError) return response({ error: 'INVALID_PASSWORD' }, 400)
  const { error: profileError } = await service.from('profiles').update({ must_change_password: false }).eq('id', verifiedUserId)
  if (profileError) return response({ error: 'PROFILE_UPDATE_FAILED' }, 500)
  const newCode = generateRecoveryCode()
  const { error: codeError } = await service.rpc('set_recovery_code', { p_user_id: verifiedUserId, p_code: newCode })
  if (codeError) return response({ error: 'RECOVERY_CODE_ISSUE_FAILED' }, 500)
  return response({ new_code: formatRecoveryCode(newCode) })
})
