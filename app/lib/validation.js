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

// True when the player has placed at least one value or note in a non-given
// cell — i.e. there is progress a reset / new game would discard.
export function hasEntries(board) {
  return board.some((cell) => !cell.given && (cell.value != null || cell.notes.length > 0))
}

// Indices of non-given cells whose value already matches the solution. These
// are "locked" — correct entries the player should not be able to edit by
// mistake. Givens are excluded; they are immutable by their own rule.
export function lockedCells(board, solution) {
  const locked = new Set()
  for (let i = 0; i < 81; i++) {
    const cell = board[i]
    if (!cell.given && cell.value != null && cell.value === solution[i]) locked.add(i)
  }
  return locked
}

// True when placing `nextValue` in a cell is a *new wrong* value: an actual
// change away from the previous value, to something other than the solution
// digit. Re-placing the same wrong value, erasing, and correct placements never
// strike. This is the whole anti-spam rule — abusing instant feedback by cycling
// digits now costs one strike per distinct wrong guess.
export function isStrike(prevValue, nextValue, solutionDigit) {
  return nextValue !== prevValue && nextValue !== solutionDigit
}
