import { describe, it, expect } from 'vitest'
import { sameNumberCells, sameNumberCellsForDigit } from './highlight'
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

describe('sameNumberCellsForDigit', () => {
  it('returns an empty set when digit is null', () => {
    const board = createBoard(emptyGivens())
    board[0] = { value: 5, given: false, notes: [] }
    expect(sameNumberCellsForDigit(board, null, 0).size).toBe(0)
  })

  it('highlights every cell with the digit even when the selected cell is empty', () => {
    const board = createBoard(emptyGivens())
    board[0] = { value: 5, given: false, notes: [] }
    board[40] = { value: 5, given: true, notes: [] }
    board[10] = { value: null, given: false, notes: [5] } // notes don't count
    // selected cell (1) is empty, but digit 5 is remembered → both 5s highlight
    const result = sameNumberCellsForDigit(board, 5, 1)
    expect(result.has(0)).toBe(true)
    expect(result.has(40)).toBe(true)
    expect(result.has(10)).toBe(false)
    expect(result.size).toBe(2)
  })

  it('excludes the selected cell when it holds the digit', () => {
    const board = createBoard(emptyGivens())
    board[0] = { value: 5, given: false, notes: [] }
    board[40] = { value: 5, given: false, notes: [] }
    const result = sameNumberCellsForDigit(board, 5, 0)
    expect(result.has(0)).toBe(false)
    expect(result.has(40)).toBe(true)
    expect(result.size).toBe(1)
  })

  it('matches with no selection (selectedIndex null)', () => {
    const board = createBoard(emptyGivens())
    board[0] = { value: 3, given: false, notes: [] }
    board[5] = { value: 3, given: false, notes: [] }
    expect(sameNumberCellsForDigit(board, 3, null).size).toBe(2)
  })
})
