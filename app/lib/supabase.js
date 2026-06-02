import { createClient } from '@supabase/supabase-js'

let client = null

// Lazily create a single Supabase client. Returns null when the project is not
// configured, so the app degrades to guest-only play instead of crashing.
export function getSupabase() {
  if (client) return client
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !key) return null
  client = createClient(url, key)
  return client
}

// Test-only: clear the memoized client so env changes take effect.
export function __resetSupabaseForTests() {
  client = null
}
