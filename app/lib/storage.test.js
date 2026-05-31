import { describe, it, expect, beforeEach } from 'vitest'
import { saveGame, loadGame, STORAGE_KEY, STORAGE_VERSION } from './storage'

function fakeStorage(initial = {}) {
  const map = new Map(Object.entries(initial))
  return {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => map.set(k, v),
    removeItem: (k) => map.delete(k),
  }
}

describe('storage', () => {
  let store
  beforeEach(() => {
    store = fakeStorage()
  })

  it('round-trips board and puzzleId', () => {
    const state = { board: [{ value: 1, given: true, notes: [] }], puzzleId: 'easy-1' }
    saveGame(state, store)
    expect(loadGame(store)).toEqual(state)
  })

  it('returns null when nothing is saved', () => {
    expect(loadGame(store)).toBe(null)
  })

  it('returns null on unparseable data', () => {
    store.setItem(STORAGE_KEY, '{not json')
    expect(loadGame(store)).toBe(null)
  })

  it('returns null on version mismatch', () => {
    store.setItem(STORAGE_KEY, JSON.stringify({ version: STORAGE_VERSION + 1, board: [], puzzleId: 'x' }))
    expect(loadGame(store)).toBe(null)
  })

  it('does not throw when setItem throws', () => {
    const throwing = { getItem: () => null, setItem: () => { throw new Error('full') }, removeItem: () => {} }
    expect(() => saveGame({ board: [], puzzleId: 'x' }, throwing)).not.toThrow()
  })
})
