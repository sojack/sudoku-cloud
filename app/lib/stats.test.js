import { describe, it, expect } from 'vitest'
import { defaultStats, todayLocal, yesterday } from './stats'

describe('defaultStats', () => {
  it('returns a zeroed record with the documented shape', () => {
    const s = defaultStats()
    expect(s.version).toBe(1)
    expect(s.solved).toEqual({ total: 0, easy: 0, medium: 0, hard: 0, custom: 0 })
    expect(s.streak).toEqual({ current: 0, best: 0, lastSolveDate: null })
    expect(s.daily).toEqual({ date: null, count: 0 })
    expect(s.badges).toEqual([])
  })
})

describe('yesterday', () => {
  it('returns the previous calendar day', () => {
    expect(yesterday('2026-03-02')).toBe('2026-03-01')
  })
  it('crosses a month boundary', () => {
    expect(yesterday('2026-03-01')).toBe('2026-02-28')
  })
  it('crosses a year boundary', () => {
    expect(yesterday('2026-01-01')).toBe('2025-12-31')
  })
})

describe('todayLocal', () => {
  it('formats as YYYY-MM-DD', () => {
    expect(todayLocal()).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })
})

import { recordSolve, BADGES } from './stats'

describe('BADGES', () => {
  it('defines the total and day milestones', () => {
    const ids = BADGES.map((b) => b.id)
    expect(ids).toEqual([
      'solve-10', 'solve-50', 'solve-75', 'solve-100', 'solve-150', 'solve-200',
      'day-2', 'day-5', 'day-8', 'day-10',
    ])
  })
})

describe('recordSolve counts', () => {
  it('increments total and the named category', () => {
    const { stats } = recordSolve(defaultStats(), { category: 'easy', date: '2026-06-01' })
    expect(stats.solved.total).toBe(1)
    expect(stats.solved.easy).toBe(1)
    expect(stats.solved.medium).toBe(0)
  })
  it('counts make-mode solves under custom', () => {
    const { stats } = recordSolve(defaultStats(), { category: 'custom', date: '2026-06-01' })
    expect(stats.solved.custom).toBe(1)
    expect(stats.solved.total).toBe(1)
  })
  it('does not mutate the input record', () => {
    const base = defaultStats()
    recordSolve(base, { category: 'hard', date: '2026-06-01' })
    expect(base.solved.total).toBe(0)
  })
})

describe('recordSolve streak', () => {
  it('first solve sets current and best to 1', () => {
    const { stats } = recordSolve(defaultStats(), { category: 'easy', date: '2026-06-01' })
    expect(stats.streak.current).toBe(1)
    expect(stats.streak.best).toBe(1)
    expect(stats.streak.lastSolveDate).toBe('2026-06-01')
  })
  it('a same-day second solve leaves the streak unchanged but still counts', () => {
    let s = recordSolve(defaultStats(), { category: 'easy', date: '2026-06-01' }).stats
    const { stats } = recordSolve(s, { category: 'medium', date: '2026-06-01' })
    expect(stats.streak.current).toBe(1)
    expect(stats.solved.total).toBe(2)
    expect(stats.daily.count).toBe(2)
  })
  it('a consecutive day increments the streak', () => {
    let s = recordSolve(defaultStats(), { category: 'easy', date: '2026-06-01' }).stats
    s = recordSolve(s, { category: 'easy', date: '2026-06-02' }).stats
    expect(s.streak.current).toBe(2)
    expect(s.streak.best).toBe(2)
  })
  it('a gap resets current to 1 but keeps best', () => {
    let s = recordSolve(defaultStats(), { category: 'easy', date: '2026-06-01' }).stats
    s = recordSolve(s, { category: 'easy', date: '2026-06-02' }).stats
    s = recordSolve(s, { category: 'easy', date: '2026-06-05' }).stats
    expect(s.streak.current).toBe(1)
    expect(s.streak.best).toBe(2)
  })
})

describe('recordSolve daily count', () => {
  it('resets the daily count on a new day', () => {
    let s = recordSolve(defaultStats(), { category: 'easy', date: '2026-06-01' }).stats
    expect(s.daily).toEqual({ date: '2026-06-01', count: 1 })
    s = recordSolve(s, { category: 'easy', date: '2026-06-02' }).stats
    expect(s.daily).toEqual({ date: '2026-06-02', count: 1 })
  })
})

describe('recordSolve badges', () => {
  it('awards a total badge when the threshold is crossed, exactly once', () => {
    const s = defaultStats()
    s.solved = { total: 9, easy: 9, medium: 0, hard: 0, custom: 0 }
    const first = recordSolve(s, { category: 'easy', date: '2026-06-01' })
    expect(first.newBadges.map((b) => b.id)).toContain('solve-10')
    const second = recordSolve(first.stats, { category: 'easy', date: '2026-06-01' })
    expect(second.newBadges.map((b) => b.id)).not.toContain('solve-10')
  })
  it('awards a day badge when enough solves happen in one day', () => {
    let s = defaultStats()
    let last
    for (let i = 0; i < 2; i++) {
      last = recordSolve(s, { category: 'easy', date: '2026-06-01' })
      s = last.stats
    }
    expect(last.newBadges.map((b) => b.id)).toContain('day-2')
  })
  it('can award multiple badges in a single solve', () => {
    const s = defaultStats()
    s.solved = { total: 49, easy: 49, medium: 0, hard: 0, custom: 0 }
    s.daily = { date: '2026-06-01', count: 1 }
    s.badges = ['solve-10']
    const { newBadges } = recordSolve(s, { category: 'easy', date: '2026-06-01' })
    const ids = newBadges.map((b) => b.id)
    expect(ids).toContain('solve-50')
    expect(ids).toContain('day-2')
  })
})
