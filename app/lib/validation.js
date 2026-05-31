// Rule-based validation and game-status derivations.
// A board is 81 cells of { value: 1-9 | null, given: boolean }.

import { peersOf } from './grid'

// Indices of filled cells whose value duplicates a peer's value.
// Both members of any duplicate are included.
export function conflicts(board) {
  const flagged = new Set()

  for (let i = 0; i < 81; i++) {
    const value = board[i].value
    if (value == null) continue
    for (const p of peersOf(i)) {
      if (board[p].value === value) {
        flagged.add(i)
        flagged.add(p)
      }
    }
  }

  return flagged
}

export function conflictCount(board) {
  return conflicts(board).size
}

// For each digit 1-9, how many are still to be placed (clamped at 0).
export function remainingByDigit(board) {
  const remaining = {}
  for (let d = 1; d <= 9; d++) remaining[d] = 9

  for (const cell of board) {
    if (cell.value != null) {
      remaining[cell.value] = Math.max(0, remaining[cell.value] - 1)
    }
  }

  return remaining
}

export function isComplete(board) {
  return board.every((cell) => cell.value != null)
}

export function isWon(board) {
  return isComplete(board) && conflicts(board).size === 0
}
