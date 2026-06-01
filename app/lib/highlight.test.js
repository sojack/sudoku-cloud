import { describe, it, expect } from 'vitest'
import { sameNumberCells } from './highlight'
import { createBoard } from './board'

function emptyGivens() {
  return Array(81).fill(null)
}

describe('sameNumberCells', () => {
  it('returns an empty set when selectedIndex is null', () => {
    const board = createBoard(emptyGivens())
    expect(sameNumberCells(board, null).size).toBe(0)
  })

  it('returns an empty set when the selected cell is empty', () => {
    const board = createBoard(emptyGivens())
    board[1] = { value: 5, given: false, notes: [] }
    // index 0 is empty and selected → nothing highlights even though a 5 exists
    expect(sameNumberCells(board, 0).size).toBe(0)
  })

  it('highlights other cells with the same value, excluding the selected cell', () => {
    const board = createBoard(emptyGivens())
    board[0] = { value: 5, given: false, notes: [] }
    board[1] = { value: 5, given: true, notes: [] }
    board[40] = { value: 5, given: false, notes: [] }
    board[2] = { value: 3, given: false, notes: [] }
    const result = sameNumberCells(board, 0)
    expect(result.has(0)).toBe(false) // excludes the selected cell
    expect(result.has(1)).toBe(true)
    expect(result.has(40)).toBe(true)
    expect(result.has(2)).toBe(false) // different value
    expect(result.size).toBe(2)
  })

  it('does not match cells that only have the digit in notes', () => {
    const board = createBoard(emptyGivens())
    board[0] = { value: 7, given: false, notes: [] }
    board[5] = { value: null, given: false, notes: [7] } // 7 only as a note
    const result = sameNumberCells(board, 0)
    expect(result.has(5)).toBe(false)
    expect(result.size).toBe(0)
  })

  it('returns an empty set when the value appears only once', () => {
    const board = createBoard(emptyGivens())
    board[0] = { value: 9, given: false, notes: [] }
    expect(sameNumberCells(board, 0).size).toBe(0)
  })
})
