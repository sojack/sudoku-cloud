// Pure index helpers for a flat, row-major 9x9 Sudoku grid (indices 0..80).

export function rowOf(i) {
  return Math.floor(i / 9)
}

export function colOf(i) {
  return i % 9
}

export function boxOf(i) {
  return Math.floor(rowOf(i) / 3) * 3 + Math.floor(colOf(i) / 3)
}

// The 20 cells sharing a row, column, or box with cell i (excluding i itself).
export function peersOf(i) {
  const peers = new Set()
  const row = rowOf(i)
  const col = colOf(i)
  const box = boxOf(i)

  for (let j = 0; j < 81; j++) {
    if (j === i) continue
    if (rowOf(j) === row || colOf(j) === col || boxOf(j) === box) {
      peers.add(j)
    }
  }

  return [...peers]
}
