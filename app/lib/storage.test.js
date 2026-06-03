import { describe, it, expect, beforeEach } from 'vitest'
import { saveGame, loadGame, clearGame, STORAGE_VERSION } from './storage'

function mockLocalStorage() {
  const store = new Map()
  return {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => store.set(k, String(v)),
    removeItem: (k) => store.delete(k),
  }
}

beforeEach(() => {
  globalThis.localStorage = mockLocalStorage()
})

describe('savegame persistence', () => {
  it('is at version 3', () => {
    expect(STORAGE_VERSION).toBe(3)
  })
  it('round-trips category and recorded', () => {
    saveGame({
      board: [{ value: 1, given: true, notes: [] }],
      solution: [1],
      difficulty: 'hard',
      category: 'custom',
      recorded: true,
    })
    const loaded = loadGame()
    expect(loaded.difficulty).toBe('hard')
    expect(loaded.category).toBe('custom')
    expect(loaded.recorded).toBe(true)
  })
  it('drops a record from an older version', () => {
    localStorage.setItem(
      'sudoku-cloud:savegame',
      JSON.stringify({ version: 2, board: [], solution: [] })
    )
    expect(loadGame()).toBe(null)
  })
  it('returns null when nothing is saved', () => {
    expect(loadGame()).toBe(null)
  })
  it('clears a saved game', () => {
    saveGame({
      board: [{ value: 1, given: true, notes: [] }],
      solution: [1],
      difficulty: 'easy',
      category: 'easy',
      recorded: false,
    })
    clearGame()
    expect(loadGame()).toBe(null)
  })
  it('stamps savedAt when saving and returns it on load', () => {
    saveGame({ board: [], solution: [], difficulty: 'easy', category: 'easy', recorded: false })
    const loaded = loadGame()
    expect(typeof loaded.savedAt).toBe('number')
    expect(loaded.savedAt).toBeGreaterThan(0)
  })
  it('defaults savedAt to 0 for a legacy save written without it', () => {
    localStorage.setItem(
      'sudoku-cloud:savegame',
      JSON.stringify({ version: STORAGE_VERSION, board: [], solution: [], difficulty: 'easy' })
    )
    expect(loadGame().savedAt).toBe(0)
  })
  it('preserves an explicitly provided savedAt instead of restamping', () => {
    // Guards the sync footgun: re-saving a restored board must not bump its
    // timestamp, or a stale board could win newest-wins over a newer remote.
    saveGame({ board: [], solution: [], difficulty: 'easy', category: 'easy', recorded: false, savedAt: 12345 })
    expect(loadGame().savedAt).toBe(12345)
  })
})
