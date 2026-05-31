// Pure board reducer. State is the 81-cell board array.

import { createBoard } from './board'
import { peersOf } from './grid'

export function boardReducer(state, action) {
  switch (action.type) {
    case 'setValue': {
      const { index, value } = action
      if (state[index].given) return state
      if (!(value >= 1 && value <= 9)) return state
      const next = state.slice()
      next[index] = { ...next[index], value, notes: [] }
      for (const p of peersOf(index)) {
        if (next[p].notes.includes(value)) {
          next[p] = { ...next[p], notes: next[p].notes.filter((n) => n !== value) }
        }
      }
      return next
    }

    case 'clearCell': {
      const { index } = action
      if (state[index].given) return state
      return replaceCell(state, index, null)
    }

    case 'newGame':
      return createBoard(action.givens)

    default:
      return state
  }
}

function replaceCell(state, index, value) {
  const next = state.slice()
  next[index] = { ...next[index], value }
  return next
}
