import { describe, it, expect } from 'vitest'
import { THEME_KEY, resolveStoredTheme, nextTheme } from './theme'

describe('resolveStoredTheme', () => {
  it('returns "light" and "dark" for those exact strings', () => {
    expect(resolveStoredTheme('light')).toBe('light')
    expect(resolveStoredTheme('dark')).toBe('dark')
  })

  it('returns null for null, empty, or unknown values', () => {
    expect(resolveStoredTheme(null)).toBe(null)
    expect(resolveStoredTheme('')).toBe(null)
    expect(resolveStoredTheme('blue')).toBe(null)
    expect(resolveStoredTheme(undefined)).toBe(null)
  })
})

describe('nextTheme', () => {
  it('toggles between light and dark', () => {
    expect(nextTheme('light')).toBe('dark')
    expect(nextTheme('dark')).toBe('light')
  })
})

describe('THEME_KEY', () => {
  it('is the namespaced storage key', () => {
    expect(THEME_KEY).toBe('sudoku-cloud:theme')
  })
})
