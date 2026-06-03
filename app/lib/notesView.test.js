import { describe, it, expect } from 'vitest'
import { resolveStoredHideNotes, NOTES_HIDDEN_KEY } from './notesView'

describe('resolveStoredHideNotes', () => {
  it('is true only for the exact string "true"', () => {
    expect(resolveStoredHideNotes('true')).toBe(true)
  })
  it('is false for absent or other values', () => {
    expect(resolveStoredHideNotes(null)).toBe(false)
    expect(resolveStoredHideNotes('false')).toBe(false)
    expect(resolveStoredHideNotes('1')).toBe(false)
    expect(resolveStoredHideNotes('')).toBe(false)
  })
  it('exposes a namespaced storage key', () => {
    expect(NOTES_HIDDEN_KEY).toBe('sudoku-cloud:hidenotes')
  })
})
