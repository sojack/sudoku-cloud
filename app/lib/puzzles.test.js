import { describe, it, expect } from 'vitest'
import { PUZZLES, nextPuzzleId, puzzleById } from './puzzles'

// A complete grid is valid when every row, column, and 3x3 box is a
// permutation of 1-9.
function isValidCompleteGrid(grid) {
  if (grid.length !== 81) return false
  const groups = []
  for (let i = 0; i < 9; i++) {
    const row = [], col = [], box = []
    for (let k = 0; k < 9; k++) {
      row.push(grid[i * 9 + k])
      col.push(grid[k * 9 + i])
      const br = Math.floor(i / 3) * 3, bc = (i % 3) * 3
      box.push(grid[(br + Math.floor(k / 3)) * 9 + (bc + (k % 3))])
    }
    groups.push(row, col, box)
  }
  return groups.every((g) => new Set(g).size === 9 && g.every((v) => v >= 1 && v <= 9))
}

describe('PUZZLES', () => {
  it('has at least 6 puzzles', () => {
    expect(PUZZLES.length).toBeGreaterThanOrEqual(6)
  })

  it('each puzzle has well-formed givens', () => {
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

  it('each puzzle has a valid complete solution', () => {
    for (const p of PUZZLES) {
      expect(p.solution).toHaveLength(81)
      expect(isValidCompleteGrid(p.solution)).toBe(true)
    }
  })

  it('each solution is consistent with its givens', () => {
    for (const p of PUZZLES) {
      p.givens.forEach((g, i) => {
        if (g !== 0 && g != null) expect(p.solution[i]).toBe(g)
      })
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
