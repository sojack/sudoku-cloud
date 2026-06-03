import { describe, it, expect } from 'vitest'
import { mergeSavegame } from './mergeSavegame'

describe('mergeSavegame', () => {
  it('returns the only non-null side', () => {
    const g = { board: [1], savedAt: 5 }
    expect(mergeSavegame(g, null)).toBe(g)
    expect(mergeSavegame(null, g)).toBe(g)
    expect(mergeSavegame(null, null)).toBe(null)
  })

  it('keeps the more recently saved board', () => {
    const older = { board: ['old'], savedAt: 100 }
    const newer = { board: ['new'], savedAt: 200 }
    expect(mergeSavegame(older, newer)).toBe(newer)
    expect(mergeSavegame(newer, older)).toBe(newer)
  })

  it('treats a missing savedAt as oldest', () => {
    const legacy = { board: ['legacy'] }
    const stamped = { board: ['stamped'], savedAt: 1 }
    expect(mergeSavegame(legacy, stamped)).toBe(stamped)
  })

  it('keeps the first argument on an exact tie', () => {
    const a = { board: ['a'], savedAt: 50 }
    const b = { board: ['b'], savedAt: 50 }
    expect(mergeSavegame(a, b)).toBe(a)
  })
})
