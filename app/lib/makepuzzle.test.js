import { describe, it, expect } from 'vitest'
import { validatePuzzle } from './makepuzzle'

// A known uniquely-solvable puzzle (flat, 0 = empty) and its solution.
const UNIQUE = [
  5, 3, 0, 0, 7, 0, 0, 0, 0,
  6, 0, 0, 1, 9, 5, 0, 0, 0,
  0, 9, 8, 0, 0, 0, 0, 6, 0,
  8, 0, 0, 0, 6, 0, 0, 0, 3,
  4, 0, 0, 8, 0, 3, 0, 0, 1,
  7, 0, 0, 0, 2, 0, 0, 0, 6,
  0, 6, 0, 0, 0, 0, 2, 8, 0,
  0, 0, 0, 4, 1, 9, 0, 0, 5,
  0, 0, 0, 0, 8, 0, 0, 7, 9,
]

describe('validatePuzzle', () => {
  it('returns unique with a consistent solution for a unique puzzle', () => {
    const result = validatePuzzle(UNIQUE)
    expect(result.status).toBe('unique')
    expect(result.solution).toHaveLength(81)
    // solution agrees with every given clue
    UNIQUE.forEach((v, i) => {
      if (v !== 0) expect(result.solution[i]).toBe(v)
    })
    // solution is fully filled
    expect(result.solution.every((v) => v >= 1 && v <= 9)).toBe(true)
  })

  it('returns none for a contradictory grid', () => {
    const bad = UNIQUE.slice()
    bad[1] = 5 // two 5s in the top row (index 0 is already 5)
    expect(validatePuzzle(bad)).toEqual({ status: 'none' })
  })

  it('returns multiple for an under-constrained grid', () => {
    // Drop most clues: keep only the first two cells — far from unique.
    const sparse = Array(81).fill(0)
    sparse[0] = 5
    sparse[1] = 3
    expect(validatePuzzle(sparse)).toEqual({ status: 'multiple' })
  })

  it('returns multiple for a fully empty grid', () => {
    expect(validatePuzzle(Array(81).fill(0))).toEqual({ status: 'multiple' })
  })
})
