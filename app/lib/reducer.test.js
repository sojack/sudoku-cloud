import { describe, it, expect } from 'vitest'
import { boardReducer } from './reducer'
import { createBoard } from './board'

function emptyGivens() {
  return Array(81).fill(null)
}

describe('boardReducer - setCell', () => {
  it('sets the value of an editable cell', () => {
    const state = createBoard(emptyGivens())
    const next = boardReducer(state, { type: 'setCell', index: 0, value: 5 })
    expect(next[0].value).toBe(5)
  })

  it('does not mutate the previous state', () => {
    const state = createBoard(emptyGivens())
    boardReducer(state, { type: 'setCell', index: 0, value: 5 })
    expect(state[0].value).toBe(null)
  })

  it('ignores edits to given cells', () => {
    const givens = emptyGivens()
    givens[0] = 3
    const state = createBoard(givens)
    const next = boardReducer(state, { type: 'setCell', index: 0, value: 9 })
    expect(next[0].value).toBe(3)
  })

  it('ignores out-of-range values', () => {
    const state = createBoard(emptyGivens())
    expect(boardReducer(state, { type: 'setCell', index: 0, value: 0 })[0].value).toBe(null)
    expect(boardReducer(state, { type: 'setCell', index: 0, value: 10 })[0].value).toBe(null)
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
