// Selection-driven highlighting. A board is 81 cells of
// { value: 1-9 | null, given: boolean, notes: number[] }.

// Indices of cells whose filled value equals `digit`, excluding `selectedIndex`
// (so a selected cell holding the digit isn't double-styled). Empty set when
// `digit` is null. Notes are not matched — only filled values count.
export function sameNumberCellsForDigit(board, digit, selectedIndex) {
  const highlighted = new Set()
  if (digit == null) return highlighted
  for (let i = 0; i < 81; i++) {
    if (i === selectedIndex) continue
    if (board[i].value === digit) highlighted.add(i)
  }
  return highlighted
}

// Indices of other cells whose filled value equals the selected cell's value.
// Empty set when nothing is selected or the selected cell has no value.
export function sameNumberCells(board, selectedIndex) {
  if (selectedIndex == null) return new Set()
  return sameNumberCellsForDigit(board, board[selectedIndex].value, selectedIndex)
}
