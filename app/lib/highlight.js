// Selection-driven highlighting. A board is 81 cells of
// { value: 1-9 | null, given: boolean, notes: number[] }.

// Indices of other cells whose filled value equals the selected cell's value.
// Empty set when nothing is selected or the selected cell has no value.
// Notes are not matched — only filled values count.
export function sameNumberCells(board, selectedIndex) {
  const highlighted = new Set()
  if (selectedIndex == null) return highlighted
  const value = board[selectedIndex].value
  if (value == null) return highlighted
  for (let i = 0; i < 81; i++) {
    if (i === selectedIndex) continue
    if (board[i].value === value) highlighted.add(i)
  }
  return highlighted
}
