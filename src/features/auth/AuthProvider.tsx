import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { identifierToEmail, normalizePhone } from '../../lib/auth-identifier'
import { messages } from '../../lib/messages.th'
import { toThaiError } from '../../lib/errors'
import { supabase } from '../../lib/supabase'

export type AppRole = 'resident' | 'committee' | 'admin'
export type Profile = {
  id: string
  display_name: string
  phone: string | null
  login_identifier: string
  must_change_password: boolean
  is_active: boolean
}
export type House = { id: string; house_no: string }
type AuthContextValue = {
  session: Session | null
  profile: Profile | null
  roles: AppRole[]
  house: House | null
  loading: boolean
  authMessage: string
  login: (identifier: string, password: string) => Promise<void>
  logout: () => Promise<void>
  clearAuthMessage: () => void
  refreshProfile: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [roles, setRoles] = useState<AppRole[]>([])
  const [house, setHouse] = useState<House | null>(null)
  const [loading, setLoading] = useState(true)
  const [authMessage, setAuthMessage] = useState('')

  const loadProfile = useCallback(async (activeSession: Session | null) => {
    if (!supabase || !activeSession) {
      setProfile(null)
      setRoles([])
      setHouse(null)
      return
    }
    const userId = activeSession.user.id
    const [profileResult, rolesResult, membershipResult] = await Promise.all([
      supabase.from('profiles').select('id,display_name,phone,login_identifier,must_change_password,is_active').eq('id', userId).maybeSingle(),
      supabase.from('user_roles').select('role').eq('user_id', userId),
      supabase.from('house_members').select('houses(id,house_no)').eq('user_id', userId).maybeSingle(),
    ])
    const queryError = profileResult.error ?? rolesResult.error ?? membershipResult.error
    if (queryError) {
      await supabase.auth.signOut()
      setSession(null)
      setProfile(null)
      setRoles([])
      setHouse(null)
      setAuthMessage(toThaiError(queryError))
      return
    }
    const foundProfile = profileResult.data as Profile | null
    if (!foundProfile || !foundProfile.is_active) {
      await supabase.auth.signOut()
      setSession(null)
      setProfile(null)
      setRoles([])
      setHouse(null)
      setAuthMessage(messages.unlinkedAccount)
      return
    }
    setProfile(foundProfile)
    setRoles((rolesResult.data ?? []).map((item) => item.role as AppRole))
    const membership = membershipResult.data?.houses as unknown as House | null
    setHouse(membership ?? null)
  }, [])

  const refreshProfile = useCallback(async () => loadProfile(session), [loadProfile, session])

  useEffect(() => {
    if (!supabase) {
      setLoading(false)
      return
    }
    void supabase.auth.getSession().then(async ({ data }) => {
      setSession(data.session)
      await loadProfile(data.session)
      setLoading(false)
    })
    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession)
      window.setTimeout(() => void loadProfile(nextSession), 0)
    })
    return () => listener.subscription.unsubscribe()
  }, [loadProfile])

  const login = useCallback(async (identifier: string, password: string) => {
    if (!supabase) return
    setAuthMessage('')
    const phone = normalizePhone(identifier)
    let email = identifierToEmail(identifier)
    if (phone) {
      const { data } = await supabase.rpc('resolve_login_email', { p_phone: phone })
      if (data) email = data as string
      else throw new Error(messages.wrongCredentials)
    }
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) throw new Error(messages.wrongCredentials)
    await loadProfile(data.session)
  }, [loadProfile])

  const logout = useCallback(async () => {
    await supabase?.auth.signOut()
    setSession(null)
    setProfile(null)
    setRoles([])
    setHouse(null)
  }, [])

  const value = useMemo(
    () => ({ session, profile, roles, house, loading, authMessage, login, logout, clearAuthMessage: () => setAuthMessage(''), refreshProfile }),
    [session, profile, roles, house, loading, authMessage, login, logout, refreshProfile],
  )
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const value = useContext(AuthContext)
  if (!value) throw new Error('AuthProvider is required')
  return value
}
