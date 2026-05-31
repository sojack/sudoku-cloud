import { describe, it, expect } from 'vitest'
import {
  conflicts,
  conflictCount,
  remainingByDigit,
  isComplete,
  isWon,
} from './validation'
import { createBoard } from './board'

function emptyGivens() {
  return Array(81).fill(null)
}

// Build a board straight from a flat array of values (null = empty),
// treating none as given (sufficient for validation tests).
function boardFromValues(values) {
  return values.map((v) => ({ value: v ?? null, given: false }))
}

describe('conflicts', () => {
  it('returns an empty set for an empty board', () => {
    const board = createBoard(emptyGivens())
    expect(conflicts(board).size).toBe(0)
  })

  it('flags both cells of a row duplicate', () => {
    const values = Array(81).fill(null)
    values[0] = 5
    values[1] = 5 // same row
    const board = boardFromValues(values)
    const c = conflicts(board)
    expect(c.has(0)).toBe(true)
    expect(c.has(1)).toBe(true)
    expect(c.size).toBe(2)
  })

  it('flags a column duplicate', () => {
    const values = Array(81).fill(null)
    values[0] = 3
    values[9] = 3 // same column
    const board = boardFromValues(values)
    const c = conflicts(board)
    expect(c.has(0)).toBe(true)
    expect(c.has(9)).toBe(true)
  })

  it('flags a box duplicate', () => {
    const values = Array(81).fill(null)
    values[0] = 8
    values[10] = 8 // same top-left box (row1,col1)
    const board = boardFromValues(values)
    const c = conflicts(board)
    expect(c.has(0)).toBe(true)
    expect(c.has(10)).toBe(true)
  })

  it('does not flag identical values in unrelated cells', () => {
    const values = Array(81).fill(null)
    values[0] = 4
    values[80] = 4 // different row, col, and box
    const board = boardFromValues(values)
    expect(conflicts(board).size).toBe(0)
  })
})

describe('conflictCount', () => {
  it('counts flagged cells', () => {
    const values = Array(81).fill(null)
    values[0] = 5
    values[1] = 5
    expect(conflictCount(boardFromValues(values))).toBe(2)
  })
})

describe('remainingByDigit', () => {
  it('reports 9 remaining for every digit on an empty board', () => {
    const board = createBoard(emptyGivens())
    const rem = remainingByDigit(board)
    for (let d = 1; d <= 9; d++) expect(rem[d]).toBe(9)
  })

  it('decrements as digits are placed', () => {
    const values = Array(81).fill(null)
    values[0] = 7
    values[20] = 7
    const rem = remainingByDigit(boardFromValues(values))
    expect(rem[7]).toBe(7)
    expect(rem[1]).toBe(9)
  })

  it('does not go negative when a digit appears more than nine times', () => {
    const values = Array(81).fill(5)
    expect(remainingByDigit(boardFromValues(values))[5]).toBe(0)
  })
})

describe('isComplete', () => {
  it('is false when any cell is empty', () => {
    const board = createBoard(emptyGivens())
    expect(isComplete(board)).toBe(false)
  })

  it('is true when every cell is filled', () => {
    const board = boardFromValues(Array(81).fill(1))
    expect(isComplete(board)).toBe(true)
  })
})

describe('isWon', () => {
  it('is false for an incomplete board', () => {
    expect(isWon(createBoard(emptyGivens()))).toBe(false)
  })

  it('is false for a full board with conflicts', () => {
    expect(isWon(boardFromValues(Array(81).fill(1)))).toBe(false)
  })

  it('is true for a complete, conflict-free solution', () => {
    // A valid completed Sudoku grid.
    const solved = [
      5, 3, 4, 6, 7, 8, 9, 1, 2,
      6, 7, 2, 1, 9, 5, 3, 4, 8,
      1, 9, 8, 3, 4, 2, 5, 6, 7,
      8, 5, 9, 7, 6, 1, 4, 2, 3,
      4, 2, 6, 8, 5, 3, 7, 9, 1,
      7, 1, 3, 9, 2, 4, 8, 5, 6,
      9, 6, 1, 5, 3, 7, 2, 8, 4,
      2, 8, 7, 4, 1, 9, 6, 3, 5,
      3, 4, 5, 2, 8, 6, 1, 7, 9,
    ]
    expect(isWon(boardFromValues(solved))).toBe(true)
  })
})
