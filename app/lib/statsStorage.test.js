import { describe, it, expect, beforeEach } from 'vitest'
import { loadStats, saveStats, clearStats } from './statsStorage'
import { defaultStats } from './stats'

// Vitest runs in a node environment with no localStorage. Provide a minimal
// in-memory mock so the persistence layer can be tested.
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

describe('statsStorage', () => {
  it('returns default stats when nothing is stored', () => {
    expect(loadStats()).toEqual(defaultStats())
  })
  it('round-trips a saved record', () => {
    const s = defaultStats()
    s.solved.total = 7
    saveStats(s)
    expect(loadStats().solved.total).toBe(7)
  })
  it('returns default stats on a version mismatch', () => {
    localStorage.setItem('sudoku-cloud:stats', JSON.stringify({ version: 999 }))
    expect(loadStats()).toEqual(defaultStats())
  })
  it('returns default stats on corrupt JSON', () => {
    localStorage.setItem('sudoku-cloud:stats', '{not json')
    expect(loadStats()).toEqual(defaultStats())
  })
  it('clearStats removes the record', () => {
    saveStats(defaultStats())
    clearStats()
    expect(localStorage.getItem('sudoku-cloud:stats')).toBe(null)
  })
})
