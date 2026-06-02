import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { getSupabase, __resetSupabaseForTests } from './supabase'

describe('getSupabase', () => {
  const saved = {}
  beforeEach(() => {
    saved.url = process.env.NEXT_PUBLIC_SUPABASE_URL
    saved.key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    __resetSupabaseForTests()
  })
  afterEach(() => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = saved.url
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = saved.key
    __resetSupabaseForTests()
  })

  it('returns null when the env vars are not configured', () => {
    delete process.env.NEXT_PUBLIC_SUPABASE_URL
    delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    expect(getSupabase()).toBe(null)
  })

  it('returns a client (with an auth namespace) when configured', () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co'
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'anon-key'
    const client = getSupabase()
    expect(client).not.toBe(null)
    expect(client.auth).toBeDefined()
  })

  it('memoizes the client across calls', () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co'
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'anon-key'
    expect(getSupabase()).toBe(getSupabase())
  })
})
