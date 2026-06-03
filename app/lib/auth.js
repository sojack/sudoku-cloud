import { getSupabase } from './supabase'

// All auth flows funnel through here so components never touch the SDK.
// Each returns the raw Supabase result ({ data, error }); callers surface
// error.message inline.
export async function signUp(email, password) {
  return getSupabase().auth.signUp({ email, password })
}

export async function signIn(email, password) {
  return getSupabase().auth.signInWithPassword({ email, password })
}

export async function signOut() {
  return getSupabase().auth.signOut()
}

// Send a password-reset email. Returns the raw Supabase result.
export async function resetPassword(email) {
  return getSupabase().auth.resetPasswordForEmail(email)
}

export async function getSession() {
  return getSupabase().auth.getSession()
}

// Subscribe to sign-in/out. Returns { data: { subscription } } — call
// subscription.unsubscribe() to clean up.
export function onAuthStateChange(callback) {
  return getSupabase().auth.onAuthStateChange(callback)
}
