// Pure board reducer. State is the 81-cell board array.

import { createBoard } from './board'

export function boardReducer(state, action) {
  switch (action.type) {
    case 'setCell': {
      const { index, value } = action
      if (state[index].given) return state
      if (!(value >= 1 && value <= 9)) return state
      return replaceCell(state, index, value)
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
