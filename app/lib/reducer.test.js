import { describe, it, expect } from 'vitest'
import { boardReducer } from './reducer'
import { createBoard } from './board'

function emptyGivens() {
  return Array(81).fill(null)
}

describe('boardReducer - setValue', () => {
  it('sets the value of an editable cell', () => {
    const state = createBoard(emptyGivens())
    const next = boardReducer(state, { type: 'setValue', index: 0, value: 5 })
    expect(next[0].value).toBe(5)
  })

  it('does not mutate the previous state', () => {
    const state = createBoard(emptyGivens())
    boardReducer(state, { type: 'setValue', index: 0, value: 5 })
    expect(state[0].value).toBe(null)
  })

  it('ignores edits to given cells', () => {
    const givens = emptyGivens()
    givens[0] = 3
    const state = createBoard(givens)
    const next = boardReducer(state, { type: 'setValue', index: 0, value: 9 })
    expect(next[0].value).toBe(3)
  })

  it('ignores out-of-range values', () => {
    const state = createBoard(emptyGivens())
    expect(boardReducer(state, { type: 'setValue', index: 0, value: 0 })[0].value).toBe(null)
    expect(boardReducer(state, { type: 'setValue', index: 0, value: 10 })[0].value).toBe(null)
  })

  it("clears the cell's own notes when a value is placed", () => {
    let state = createBoard(emptyGivens())
    state = boardReducer(state, { type: 'toggleNote', index: 0, value: 4 })
    const next = boardReducer(state, { type: 'setValue', index: 0, value: 5 })
    expect(next[0].notes).toEqual([])
  })

  it('removes the placed digit from peers notes but leaves others', () => {
    // index 1 is a peer of index 0 (same row); index 80 is not a peer of 0.
    let state = createBoard(emptyGivens())
    state = boardReducer(state, { type: 'toggleNote', index: 1, value: 5 })
    state = boardReducer(state, { type: 'toggleNote', index: 1, value: 6 })
    state = boardReducer(state, { type: 'toggleNote', index: 80, value: 5 })
    const next = boardReducer(state, { type: 'setValue', index: 0, value: 5 })
    expect(next[1].notes).toEqual([6])   // 5 pruned, 6 kept
    expect(next[80].notes).toEqual([5])  // non-peer untouched
  })
})

describe('boardReducer - clearCell', () => {
  it('clears an editable cell', () => {
    let state = createBoard(emptyGivens())
    state = boardReducer(state, { type: 'setCell', index: 0, value: 5 })
    const next = boardReducer(state, { type: 'clearCell', index: 0 })
    expect(next[0].value).toBe(null)
  })

  it('does not clear given cells', () => {
    const givens = emptyGivens()
    givens[0] = 3
    const state = createBoard(givens)
    const next = boardReducer(state, { type: 'clearCell', index: 0 })
    expect(next[0].value).toBe(3)
  })
})

describe('boardReducer - newGame', () => {
  it('builds a fresh board from new givens', () => {
    const state = createBoard(emptyGivens())
    const givens = emptyGivens()
    givens[40] = 6
    const next = boardReducer(state, { type: 'newGame', givens })
    expect(next[40]).toEqual({ value: 6, given: true })
  })
})

describe('boardReducer - unknown action', () => {
  it('returns the state unchanged', () => {
    const state = createBoard(emptyGivens())
    expect(boardReducer(state, { type: 'nope' })).toBe(state)
  })
})
