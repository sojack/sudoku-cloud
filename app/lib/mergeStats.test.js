import { describe, it, expect } from 'vitest'
import { mergeStats } from './mergeStats'
import { defaultStats } from './stats'

// A fully-populated stats object for a given shape.
function stats(overrides = {}) {
  return {
    version: 1,
    solved: { total: 0, easy: 0, medium: 0, hard: 0, custom: 0 },
    streak: { current: 0, best: 0, lastSolveDate: null },
    daily: { date: null, count: 0 },
    badges: [],
    ...overrides,
  }
}

describe('mergeStats', () => {
  it('returns the populated side when the other is null/empty', () => {
    const a = stats({ solved: { total: 3, easy: 3, medium: 0, hard: 0, custom: 0 } })
    expect(mergeStats(a, null)).toEqual(a)
    expect(mergeStats(null, a)).toEqual(a)
  })

  it('does not blend across version mismatches; keeps the higher version', () => {
    const v1 = stats({ version: 1 })
    const v2 = stats({ version: 2 })
    expect(mergeStats(v1, v2)).toBe(v2)
    expect(mergeStats(v2, v1)).toBe(v2)
  })

  it('takes the max of each solved category and derives total from them', () => {
    const a = stats({ solved: { total: 5, easy: 5, medium: 0, hard: 0, custom: 0 } })
    const b = stats({ solved: { total: 4, easy: 1, medium: 3, hard: 0, custom: 0 } })
    const m = mergeStats(a, b)
    expect(m.solved).toEqual({ total: 8, easy: 5, medium: 3, hard: 0, custom: 0 })
  })

  it('uses the later lastSolveDate for current streak and maxes best', () => {
    const a = stats({ streak: { current: 2, best: 9, lastSolveDate: '2026-06-01' } })
    const b = stats({ streak: { current: 5, best: 5, lastSolveDate: '2026-06-02' } })
    const m = mergeStats(a, b)
    expect(m.streak).toEqual({ current: 5, best: 9, lastSolveDate: '2026-06-02' })
  })

  it('on an equal streak date, takes the max current', () => {
    const a = stats({ streak: { current: 2, best: 2, lastSolveDate: '2026-06-02' } })
    const b = stats({ streak: { current: 4, best: 4, lastSolveDate: '2026-06-02' } })
    expect(mergeStats(a, b).streak.current).toBe(4)
  })

  it('takes the later daily date; same date maxes the count', () => {
    const older = stats({ daily: { date: '2026-06-01', count: 8 } })
    const newer = stats({ daily: { date: '2026-06-02', count: 1 } })
    expect(mergeStats(older, newer).daily).toEqual({ date: '2026-06-02', count: 1 })

    const sameA = stats({ daily: { date: '2026-06-02', count: 2 } })
    const sameB = stats({ daily: { date: '2026-06-02', count: 5 } })
    expect(mergeStats(sameA, sameB).daily).toEqual({ date: '2026-06-02', count: 5 })
  })

  it('unions badges and re-derives any threshold the merge crosses', () => {
    // a has 6 easy, b has 5 medium → merged total 11 crosses the solve-10 badge.
    const a = stats({ solved: { total: 6, easy: 6, medium: 0, hard: 0, custom: 0 }, badges: [] })
    const b = stats({ solved: { total: 5, easy: 0, medium: 5, hard: 0, custom: 0 }, badges: [] })
    expect(mergeStats(a, b).badges).toContain('solve-10')
  })

  it('preserves already-earned badges from both sides', () => {
    const a = stats({ badges: ['solve-10'] })
    const b = stats({ badges: ['day-2'] })
    const m = mergeStats(a, b)
    expect(m.badges).toEqual(expect.arrayContaining(['solve-10', 'day-2']))
  })

  it('is commutative', () => {
    const a = stats({
      solved: { total: 7, easy: 4, medium: 3, hard: 0, custom: 0 },
      streak: { current: 3, best: 6, lastSolveDate: '2026-06-01' },
      daily: { date: '2026-06-01', count: 3 },
      badges: ['solve-10'],
    })
    const b = stats({
      solved: { total: 9, easy: 2, medium: 1, hard: 5, custom: 1 },
      streak: { current: 5, best: 5, lastSolveDate: '2026-06-02' },
      daily: { date: '2026-06-02', count: 2 },
      badges: ['day-2'],
    })
    expect(mergeStats(a, b)).toEqual(mergeStats(b, a))
  })

  it('is idempotent on a self-consistent record', () => {
    const a = stats({
      solved: { total: 6, easy: 6, medium: 0, hard: 0, custom: 0 },
      badges: [],
    })
    expect(mergeStats(a, a)).toEqual(a)
  })

  it('never decreases a count or drops a badge (monotonic)', () => {
    const a = stats({
      solved: { total: 10, easy: 10, medium: 0, hard: 0, custom: 0 },
      badges: ['solve-10'],
    })
    const b = stats({ solved: { total: 1, easy: 1, medium: 0, hard: 0, custom: 0 } })
    const m = mergeStats(a, b)
    expect(m.solved.total).toBeGreaterThanOrEqual(a.solved.total)
    expect(m.badges).toContain('solve-10')
  })

  it('produces a valid default-shaped record when merging two defaults', () => {
    expect(mergeStats(defaultStats(), defaultStats())).toEqual(defaultStats())
  })
})
