import { describe, it, expect } from 'vitest'
import { mistakes, isSolved, remainingByDigit, lockedCells } from './validation'
import { createBoard } from './board'

function emptyGivens() {
  return Array(81).fill(null)
}

// A simple known solution: each row is 1..9 rotated, which is a valid grid.
// (Used only as a reference array for mistake/solved tests.)
function refSolution() {
  const g = []
  for (let r = 0; r < 9; r++) {
    const shift = (r % 3) * 3 + Math.floor(r / 3)
    for (let c = 0; c < 9; c++) g.push(((c + shift) % 9) + 1)
  }
  return g
}

describe('mistakes', () => {
  it('flags a cell whose value differs from the solution', () => {
    const solution = refSolution()
    const board = createBoard(emptyGivens())
    board[0] = { value: solution[0] === 1 ? 2 : 1, given: false, notes: [] }
    expect(mistakes(board, solution).has(0)).toBe(true)
  })

  it('does not flag a cell whose value matches the solution', () => {
    const solution = refSolution()
    const board = createBoard(emptyGivens())
    board[0] = { value: solution[0], given: false, notes: [] }
    expect(mistakes(board, solution).has(0)).toBe(false)
  })

  it('does not flag empty cells', () => {
    const solution = refSolution()
    const board = createBoard(emptyGivens())
    expect(mistakes(board, solution).size).toBe(0)
  })

  it('does not flag given cells (they match the solution)', () => {
    const solution = refSolution()
    const givens = emptyGivens()
    givens[0] = solution[0]
    const board = createBoard(givens)
    expect(mistakes(board, solution).has(0)).toBe(false)
  })
})

describe('isSolved', () => {
  it('is false on an empty board', () => {
    const solution = refSolution()
    const board = createBoard(emptyGivens())
    expect(isSolved(board, solution)).toBe(false)
  })

  it('is false when one cell is wrong', () => {
    const solution = refSolution()
    const board = solution.map((v, i) => ({
      value: i === 0 ? (v === 1 ? 2 : 1) : v,
      given: false,
      notes: [],
    }))
    expect(isSolved(board, solution)).toBe(false)
  })

  it('is true when every cell matches the solution', () => {
    const solution = refSolution()
    const board = solution.map((v) => ({ value: v, given: false, notes: [] }))
    expect(isSolved(board, solution)).toBe(true)
  })
})

describe('lockedCells', () => {
  it('locks a non-given cell whose value matches the solution', () => {
    const solution = refSolution()
    const board = createBoard(emptyGivens())
    board[0] = { value: solution[0], given: false, notes: [] }
    expect(lockedCells(board, solution).has(0)).toBe(true)
  })

  it('does not lock an incorrect entry', () => {
    const solution = refSolution()
    const board = createBoard(emptyGivens())
    board[0] = { value: solution[0] === 1 ? 2 : 1, given: false, notes: [] }
    expect(lockedCells(board, solution).has(0)).toBe(false)
  })

  it('does not lock empty cells', () => {
    const solution = refSolution()
    const board = createBoard(emptyGivens())
    expect(lockedCells(board, solution).size).toBe(0)
  })

  it('does not include given cells (they are handled separately)', () => {
    const solution = refSolution()
    const givens = emptyGivens()
    givens[0] = solution[0]
    const board = createBoard(givens)
    expect(lockedCells(board, solution).has(0)).toBe(false)
  })
})

describe('remainingByDigit', () => {
  it('starts at 9 for every digit on an empty board', () => {
    const board = createBoard(emptyGivens())
    const r = remainingByDigit(board)
    for (let d = 1; d <= 9; d++) expect(r[d]).toBe(9)
  })

  it('counts placed values', () => {
    const board = createBoard(emptyGivens())
    board[0] = { value: 5, given: false, notes: [] }
    board[1] = { value: 5, given: false, notes: [] }
    const r = remainingByDigit(board)
    expect(r[5]).toBe(7)
  })
})
