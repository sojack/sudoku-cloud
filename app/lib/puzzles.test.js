import { describe, it, expect } from 'vitest'
import { PUZZLES, nextPuzzleId, puzzleById } from './puzzles'
import { createBoard } from './board'
import { conflicts } from './validation'

describe('PUZZLES', () => {
  it('has at least 6 puzzles', () => {
    expect(PUZZLES.length).toBeGreaterThanOrEqual(6)
  })

  it('each puzzle is well-formed', () => {
    for (const p of PUZZLES) {
      expect(typeof p.id).toBe('string')
      expect(typeof p.difficulty).toBe('string')
      expect(p.givens).toHaveLength(81)
      for (const g of p.givens) {
        expect(Number.isInteger(g)).toBe(true)
        expect(g).toBeGreaterThanOrEqual(0)
        expect(g).toBeLessThanOrEqual(9)
      }
    }
  })

  it('no puzzle has initial conflicts', () => {
    for (const p of PUZZLES) {
      expect(conflicts(createBoard(p.givens)).size).toBe(0)
    }
  })

  it('all ids are unique', () => {
    const ids = PUZZLES.map((p) => p.id)
    expect(new Set(ids).size).toBe(ids.length)
  })
})

describe('nextPuzzleId / puzzleById', () => {
  it('returns an existing id different from the current', () => {
    const id = nextPuzzleId(PUZZLES[0].id)
    expect(id).not.toBe(PUZZLES[0].id)
    expect(PUZZLES.some((p) => p.id === id)).toBe(true)
  })

  it('puzzleById returns the matching puzzle', () => {
    const p = PUZZLES[0]
    expect(puzzleById(p.id)).toBe(p)
  })
})
