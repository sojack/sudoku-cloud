import { describe, it, expect } from 'vitest'
import { pullRemote, pushRemote, syncState } from './sync'

// Minimal fake of the subset of the Supabase client these functions use:
//   client.from('game_state').select(...).eq(...).maybeSingle()  -> { data, error }
//   client.from('game_state').upsert(row)                        -> { error }
function fakeClient(initialRow = null) {
  const state = { row: initialRow, upserts: [] }
  const builder = {
    select: () => builder,
    eq: () => builder,
    maybeSingle: async () => ({ data: state.row, error: null }),
    upsert: async (row) => {
      state.upserts.push(row)
      state.row = row
      return { error: null }
    },
  }
  return { client: { from: () => builder }, state }
}

const USER = 'user-123'

describe('sync', () => {
  it('pullRemote returns the row (or null when none)', async () => {
    const empty = fakeClient(null)
    expect(await pullRemote(empty.client, USER)).toBe(null)

    const row = { savegame: { savedAt: 1 }, stats: { version: 1 } }
    const present = fakeClient(row)
    expect(await pullRemote(present.client, USER)).toEqual(row)
  })

  it('pullRemote throws on a client error', async () => {
    const errClient = {
      from: () => ({
        select: () => errClient.from(),
        eq: () => errClient.from(),
        maybeSingle: async () => ({ data: null, error: new Error('boom') }),
      }),
    }
    await expect(pullRemote(errClient, USER)).rejects.toThrow('boom')
  })

  it('pushRemote upserts the user row with derived timestamps', async () => {
    const { client, state } = fakeClient(null)
    await pushRemote(client, USER, { savegame: { savedAt: 1717286400000 }, stats: { version: 1 } })
    expect(state.upserts).toHaveLength(1)
    const row = state.upserts[0]
    expect(row.user_id).toBe(USER)
    expect(row.stats).toEqual({ version: 1 })
    expect(row.savegame_updated_at).toBe(new Date(1717286400000).toISOString())
  })

  it('syncState merges local into an empty remote and pushes the result', async () => {
    const { client, state } = fakeClient(null)
    const local = {
      savegame: { board: ['local'], savedAt: 500 },
      stats: { version: 1, solved: { total: 3, easy: 3, medium: 0, hard: 0, custom: 0 }, streak: { current: 0, best: 0, lastSolveDate: null }, daily: { date: null, count: 0 }, badges: [] },
    }
    const merged = await syncState(client, USER, local)
    expect(merged.savegame.board).toEqual(['local'])
    expect(merged.stats.solved.total).toBe(3)
    expect(state.upserts).toHaveLength(1)
  })

  it('syncState keeps the newer remote board but merges stats counts', async () => {
    const remoteRow = {
      savegame: { board: ['remote'], savedAt: 900 },
      stats: { version: 1, solved: { total: 2, easy: 0, medium: 2, hard: 0, custom: 0 }, streak: { current: 0, best: 0, lastSolveDate: null }, daily: { date: null, count: 0 }, badges: [] },
    }
    const { client } = fakeClient(remoteRow)
    const local = {
      savegame: { board: ['local'], savedAt: 500 },
      stats: { version: 1, solved: { total: 3, easy: 3, medium: 0, hard: 0, custom: 0 }, streak: { current: 0, best: 0, lastSolveDate: null }, daily: { date: null, count: 0 }, badges: [] },
    }
    const merged = await syncState(client, USER, local)
    expect(merged.savegame.board).toEqual(['remote']) // newer savedAt wins
    expect(merged.stats.solved).toEqual({ total: 5, easy: 3, medium: 2, hard: 0, custom: 0 })
  })
})
