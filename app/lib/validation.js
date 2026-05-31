// Solution-aware validation and game-status derivations.
// A board is 81 cells of { value: 1-9 | null, given: boolean, notes: number[] }.
// A solution is 81 digits 1-9 (the puzzle's unique completed grid).

// Indices of filled cells whose value differs from the solution.
// Empty cells are never mistakes; given cells match the solution by construction.
export function mistakes(board, solution) {
  const flagged = new Set()
  for (let i = 0; i < 81; i++) {
    const value = board[i].value
    if (value == null) continue
    if (value !== solution[i]) flagged.add(i)
  }
  return flagged
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

// True when every cell's value equals the solution.
export function isSolved(board, solution) {
  return board.every((cell, i) => cell.value === solution[i])
}
