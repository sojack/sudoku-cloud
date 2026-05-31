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

    case 'toggleNote': {
      const { index, value } = action
      if (state[index].given) return state
      if (state[index].value != null) return state
      if (!(value >= 1 && value <= 9)) return state
      const notes = state[index].notes
      const nextNotes = notes.includes(value)
        ? notes.filter((n) => n !== value)
        : [...notes, value].sort((a, b) => a - b)
      const next = state.slice()
      next[index] = { ...next[index], notes: nextNotes }
      return next
    }

    case 'clearCell': {
      const { index } = action
      if (state[index].given) return state
      const next = state.slice()
      next[index] = { ...next[index], value: null, notes: [] }
      return next
    }

    case 'newGame':
      return createBoard(action.givens)

    case 'restore':
      return action.board

    default:
      return state
  }
}
