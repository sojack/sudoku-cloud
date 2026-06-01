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
