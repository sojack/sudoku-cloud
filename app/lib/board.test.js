import { describe, it, expect } from 'vitest'
import { createBoard, isEditable } from './board'

// A givens grid is 81 entries, each a digit 1-9 or null/0 for empty.
function emptyGivens() {
  return Array(81).fill(null)
}

describe('createBoard', () => {
  it('produces 81 cells', () => {
    expect(createBoard(emptyGivens())).toHaveLength(81)
  })

  it('marks filled givens as given with their value', () => {
    const givens = emptyGivens()
    givens[0] = 7
    const board = createBoard(givens)
    expect(board[0]).toEqual({ value: 7, given: true, notes: [] })
  })

  it('marks empty cells as non-given with null value', () => {
    const board = createBoard(emptyGivens())
    expect(board[0]).toEqual({ value: null, given: false, notes: [] })
  })

  it('treats 0 as empty', () => {
    const givens = emptyGivens()
    givens[5] = 0
    const board = createBoard(givens)
    expect(board[5]).toEqual({ value: null, given: false, notes: [] })
  })

  it('initializes every cell with an empty notes array', () => {
    const givens = Array(81).fill(null)
    givens[0] = 3
    const board = createBoard(givens)
    expect(board[0]).toEqual({ value: 3, given: true, notes: [] })
    expect(board[1]).toEqual({ value: null, given: false, notes: [] })
  })
})

describe('isEditable', () => {
  it('is false for given cells', () => {
    const givens = emptyGivens()
    givens[0] = 7
    const board = createBoard(givens)
    expect(isEditable(board, 0)).toBe(false)
  })

  it('is true for empty cells', () => {
    const board = createBoard(emptyGivens())
    expect(isEditable(board, 0)).toBe(true)
  })
})
