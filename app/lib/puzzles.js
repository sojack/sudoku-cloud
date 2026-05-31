// Bundled set of genuine, uniquely-solvable Sudoku puzzles.
// Each puzzle: row-major flat array of 81 numbers, 0 = empty.
//
// Sources:
//  - easy-1: the original DEFAULT_GIVENS from the Phase 1 UI (the classic
//    Wikipedia "Sudoku" sample puzzle).
//  - easy-2 / medium-1 / medium-2: well-known published sample puzzles.
//  - hard-1: "AI Escargot" by Arto Inkala (2006), a famously difficult board.
//  - hard-2: Arto Inkala's 2012 puzzle, billed as the "world's hardest Sudoku".
//
// Every puzzle has been verified to be conflict-free and to have exactly one
// solution.

export const PUZZLES = [
  {
    id: 'easy-1',
    difficulty: 'easy',
    givens: [
      5, 3, 0, 0, 7, 0, 0, 0, 0,
      6, 0, 0, 1, 9, 5, 0, 0, 0,
      0, 9, 8, 0, 0, 0, 0, 6, 0,
      8, 0, 0, 0, 6, 0, 0, 0, 3,
      4, 0, 0, 8, 0, 3, 0, 0, 1,
      7, 0, 0, 0, 2, 0, 0, 0, 6,
      0, 6, 0, 0, 0, 0, 2, 8, 0,
      0, 0, 0, 4, 1, 9, 0, 0, 5,
      0, 0, 0, 0, 8, 0, 0, 7, 9,
    ],
  },
  {
    id: 'easy-2',
    difficulty: 'easy',
    givens: [
      0, 0, 3, 0, 2, 0, 6, 0, 0,
      9, 0, 0, 3, 0, 5, 0, 0, 1,
      0, 0, 1, 8, 0, 6, 4, 0, 0,
      0, 0, 8, 1, 0, 2, 9, 0, 0,
      7, 0, 0, 0, 0, 0, 0, 0, 8,
      0, 0, 6, 7, 0, 8, 2, 0, 0,
      0, 0, 2, 6, 0, 9, 5, 0, 0,
      8, 0, 0, 2, 0, 3, 0, 0, 9,
      0, 0, 5, 0, 1, 0, 3, 0, 0,
    ],
  },
  {
    id: 'medium-1',
    difficulty: 'medium',
    givens: [
      2, 0, 0, 0, 8, 0, 3, 0, 0,
      0, 6, 0, 0, 7, 0, 0, 8, 4,
      0, 3, 0, 5, 0, 0, 2, 0, 9,
      0, 0, 0, 1, 0, 5, 4, 0, 8,
      0, 0, 0, 0, 0, 0, 0, 0, 0,
      4, 0, 2, 7, 0, 6, 0, 0, 0,
      3, 0, 1, 0, 0, 7, 0, 4, 0,
      7, 2, 0, 0, 4, 0, 0, 6, 0,
      0, 0, 4, 0, 1, 0, 0, 0, 3,
    ],
  },
  {
    id: 'medium-2',
    difficulty: 'medium',
    givens: [
      0, 0, 0, 0, 0, 0, 9, 0, 7,
      0, 0, 0, 4, 2, 0, 1, 8, 0,
      0, 0, 0, 7, 0, 5, 0, 2, 6,
      1, 0, 0, 9, 0, 4, 0, 0, 0,
      0, 5, 0, 0, 0, 0, 0, 4, 0,
      0, 0, 0, 5, 0, 7, 0, 0, 9,
      9, 2, 0, 1, 0, 8, 0, 0, 0,
      0, 3, 4, 0, 5, 9, 0, 0, 0,
      5, 0, 7, 0, 0, 0, 0, 0, 0,
    ],
  },
  {
    id: 'hard-1',
    difficulty: 'hard',
    givens: [
      1, 0, 0, 0, 0, 7, 0, 9, 0,
      0, 3, 0, 0, 2, 0, 0, 0, 8,
      0, 0, 9, 6, 0, 0, 5, 0, 0,
      0, 0, 5, 3, 0, 0, 9, 0, 0,
      0, 1, 0, 0, 8, 0, 0, 0, 2,
      6, 0, 0, 0, 0, 4, 0, 0, 0,
      3, 0, 0, 0, 0, 0, 0, 1, 0,
      0, 4, 0, 0, 0, 0, 0, 0, 7,
      0, 0, 7, 0, 0, 0, 3, 0, 0,
    ],
  },
  {
    id: 'hard-2',
    difficulty: 'hard',
    givens: [
      8, 0, 0, 0, 0, 0, 0, 0, 0,
      0, 0, 3, 6, 0, 0, 0, 0, 0,
      0, 7, 0, 0, 9, 0, 2, 0, 0,
      0, 5, 0, 0, 0, 7, 0, 0, 0,
      0, 0, 0, 0, 4, 5, 7, 0, 0,
      0, 0, 0, 1, 0, 0, 0, 3, 0,
      0, 0, 1, 0, 0, 0, 0, 6, 8,
      0, 0, 8, 5, 0, 0, 0, 1, 0,
      0, 9, 0, 0, 0, 0, 4, 0, 0,
    ],
  },
];

export function puzzleById(id) {
  return PUZZLES.find((p) => p.id === id);
}

export function nextPuzzleId(currentId) {
  const idx = PUZZLES.findIndex((p) => p.id === currentId);
  if (idx === -1) return PUZZLES[0].id;
  return PUZZLES[(idx + 1) % PUZZLES.length].id;
}
