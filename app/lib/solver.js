// Pure backtracking Sudoku solver over an 81-element flat array (0 = empty).

function findEmpty(board) {
  for (let i = 0; i < 81; i++) {
    if (board[i] === 0) return i;
  }
  return -1;
}

function isValid(board, idx, val) {
  const row = Math.floor(idx / 9);
  const col = idx % 9;
  for (let c = 0; c < 9; c++) {
    if (board[row * 9 + c] === val) return false;
  }
  for (let r = 0; r < 9; r++) {
    if (board[r * 9 + col] === val) return false;
  }
  const boxRow = Math.floor(row / 3) * 3;
  const boxCol = Math.floor(col / 3) * 3;
  for (let r = boxRow; r < boxRow + 3; r++) {
    for (let c = boxCol; c < boxCol + 3; c++) {
      if (board[r * 9 + c] === val) return false;
    }
  }
  return true;
}

function solveInPlace(board) {
  const idx = findEmpty(board);
  if (idx === -1) return true;
  for (let val = 1; val <= 9; val++) {
    if (isValid(board, idx, val)) {
      board[idx] = val;
      if (solveInPlace(board)) return true;
      board[idx] = 0;
    }
  }
  return false;
}

export function solve(givens) {
  const board = givens.slice();
  return solveInPlace(board) ? board : null;
}

// Counts up to `cap` solutions; stops as soon as `cap` is reached.
export function countSolutions(givens, cap = 2) {
  const board = givens.slice();
  let count = 0;
  function recurse() {
    if (count >= cap) return;
    const idx = findEmpty(board);
    if (idx === -1) {
      count++;
      return;
    }
    for (let val = 1; val <= 9; val++) {
      if (isValid(board, idx, val)) {
        board[idx] = val;
        recurse();
        board[idx] = 0;
        if (count >= cap) return;
      }
    }
  }
  recurse();
  return count;
}
