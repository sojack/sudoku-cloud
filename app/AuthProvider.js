'use client'
import { createContext, useContext, useEffect, useState } from 'react'
import { getSupabase } from './lib/supabase'
import { getSession, onAuthStateChange, signIn, signUp, signOut, resetPassword } from './lib/auth'

const AuthContext = createContext(null)

export function useAuth() {
  return useContext(AuthContext)
}

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null)
  const [ready, setReady] = useState(false)
  const configured = getSupabase() != null

  useEffect(() => {
    if (!configured) {
      setReady(true)
      return
    }
    getSession().then(({ data }) => {
      setSession(data.session ?? null)
      setReady(true)
    })
    const { data } = onAuthStateChange((_event, nextSession) => {
      setSession(nextSession ?? null)
    })
    return () => data.subscription.unsubscribe()
  }, [configured])

  const value = {
    configured,
    ready,
    session,
    user: session?.user ?? null,
    signIn,
    signUp,
    signOut,
    resetPassword,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
