import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock the client factory so auth.js calls a fake auth namespace.
const fakeAuth = {
  signUp: vi.fn(async () => ({ data: { user: { id: 'u1' } }, error: null })),
  signInWithPassword: vi.fn(async () => ({ data: { session: {} }, error: null })),
  signOut: vi.fn(async () => ({ error: null })),
  resetPasswordForEmail: vi.fn(async () => ({ data: {}, error: null })),
  getSession: vi.fn(async () => ({ data: { session: null } })),
  onAuthStateChange: vi.fn(() => ({ data: { subscription: { unsubscribe: vi.fn() } } })),
}
vi.mock('./supabase', () => ({ getSupabase: () => ({ auth: fakeAuth }) }))

const { signUp, signIn, signOut, resetPassword, getSession, onAuthStateChange } = await import('./auth')

beforeEach(() => {
  Object.values(fakeAuth).forEach((fn) => fn.mockClear?.())
})

describe('auth wrapper', () => {
  it('signUp forwards email and password', async () => {
    await signUp('a@b.com', 'pw')
    expect(fakeAuth.signUp).toHaveBeenCalledWith({ email: 'a@b.com', password: 'pw' })
  })
  it('signIn calls signInWithPassword', async () => {
    await signIn('a@b.com', 'pw')
    expect(fakeAuth.signInWithPassword).toHaveBeenCalledWith({ email: 'a@b.com', password: 'pw' })
  })
  it('signOut calls through', async () => {
    await signOut()
    expect(fakeAuth.signOut).toHaveBeenCalled()
  })
  it('resetPassword sends a reset email for the address', async () => {
    await resetPassword('a@b.com')
    expect(fakeAuth.resetPasswordForEmail).toHaveBeenCalledWith('a@b.com')
  })
  it('onAuthStateChange registers a callback', () => {
    const cb = () => {}
    onAuthStateChange(cb)
    expect(fakeAuth.onAuthStateChange).toHaveBeenCalledWith(cb)
  })
})
