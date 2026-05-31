// Board construction from a givens grid.
//
// A givens grid is 81 entries, each a digit 1-9 (a clue) or null/0 (empty).
// A board is 81 cells of the shape { value: 1-9 | null, given: boolean }.

export function createBoard(givens) {
  return givens.map((g) => {
    const filled = typeof g === 'number' && g >= 1 && g <= 9
    return filled
      ? { value: g, given: true, notes: [] }
      : { value: null, given: false, notes: [] }
  })
}

export function isEditable(board, i) {
  return !board[i].given
}
