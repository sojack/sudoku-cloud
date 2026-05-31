# Solution-Aware Mistake Checking Design

Date: 2026-05-31

## Goal

Replace rule-based conflict checking with solution-aware mistake checking so
the player can never wander into an unrecoverable dead end. Today a digit is
flagged only when it duplicates a peer in its row/column/box; a move that is
individually legal but inconsistent with the puzzle's true solution goes
unflagged until a contradiction surfaces many moves later, forcing a reset.
Because every bundled puzzle has exactly one solution, "this move leads to a
dead end" is exactly "this digit differs from the solution" — so we flag the
wrong cell the instant it is entered.

## Decisions

- **Wrong move:** allowed but flagged immediately. The digit is placed and the
  cell turns red the moment its value differs from the solution; the player can
  erase or overwrite it. No dead ends, because the wrong cell is always visible
  at the moment it is created.
- **Check style:** replace conflicts with mistakes. The row/column/box conflict
  highlight and the `conflicts`/`conflictCount` functions are removed. A cell is
  red only when it does not match the solution.
- **Counter:** the StatusBar shows **"Mistakes: N"** (red when N > 0).
- **Solution source:** store a precomputed `solution` per puzzle in
  `puzzles.js`. No solver code (YAGNI — the bundled set is fixed; Phase 3's
  generator will introduce a solver when it is actually needed).
- **Win condition:** a board is won when every cell equals the solution.

## Data Model

Each puzzle in `app/lib/puzzles.js` gains a `solution`:

```js
{ id, difficulty, givens, solution }  // solution: 81 digits 1-9, the unique
                                      // completed grid for givens
```

- `solution` is static data, computed once offline and stored.
- `solution` is **not** persisted to localStorage. On restore, it is looked up
  from the saved `puzzleId`, keeping saved games small and forward-compatible.
- The cell shape (`{ value, given, notes }`) is unchanged.

## Logic Library (`app/lib/validation.js`)

- **`mistakes(board, solution)`** → a `Set` of indices where the cell has a
  value that differs from `solution[i]`. Empty cells (`value == null`) are never
  mistakes. Given cells are never mistakes (their values come from `givens`,
  which agree with the solution).
- **`isSolved(board, solution)`** → `true` when every cell's value equals the
  solution. Replaces `isWon`.
- **Remove:** `conflicts(board)`, `conflictCount(board)`, and `isWon(board)`.
- **Keep:** `remainingByDigit(board)` (the keypad still uses it). `isComplete`
  may be removed if unused after this change, or kept if still referenced —
  implementation removes it only if it has no remaining callers.

`peersOf` in `grid.js` becomes unused by validation; leave `grid.js` as-is (it
is small, tested, and harmless — no unrelated refactoring).

## Components (`app/`)

- **`Game.js`** — accept `puzzle.solution`; hold it so New game / Reset can look
  up the current puzzle's solution alongside its givens. Derive `mistakes` and
  `won` via `useMemo` from `[board, solution]`. Pass the mistakes set to
  `Board` and the count to `StatusBar`.
- **`StatusBar.js`** — prop becomes `mistakeCount`; renders "Mistakes: N", red
  (existing `.wrong`) when N > 0.
- **`Board.js`** — prop becomes `mistakes` (a Set); passes
  `mistake={mistakes.has(i)}` to each `Cell`.
- **`Cell.js`** — prop `conflicted` renamed to `mistake`; the cell uses the
  existing `.wrong` style when `mistake` is true. No layout change.

## Behaviour

- Placing a digit that differs from the solution: the value is stored and the
  cell is flagged red immediately.
- Erasing or overwriting a mistaken cell clears the flag as soon as the value
  matches (or the cell is emptied).
- Given cells are never flagged.
- The win message appears when `isSolved` is true (board full and every value
  matches the solution).

## Persistence

Unchanged in shape. Saved state remains `{ board, puzzleId }`. On load, the
solution is obtained from `puzzleById(puzzleId).solution`, not from storage.
The storage version does not change (no stored-shape change).

## Testing Strategy

- **TDD, Vitest, colocated `*.test.js`.**
- **`validation.js`:** `mistakes` flags a wrong-valued cell, does not flag
  correct cells or empty cells, and does not flag given cells; `isSolved` is
  true only for a full correct board and false when any cell is empty or wrong.
- **`puzzles.js`:** for every puzzle, `solution` has length 81 with digits 1-9,
  is itself conflict-free as a complete grid (each row, column, and box is a
  permutation of 1-9), and is consistent with `givens` (equals `givens[i]` at
  every given cell).
- **Existing tests:** remove/replace the `conflicts`/`conflictCount`/`isWon`
  tests; keep `remainingByDigit` tests.
- **UI:** verified via `npm run build` and manual play (enter a wrong digit →
  immediate red; correct it → red clears; solve → win).

## Out of Scope

- A runtime solver and puzzle generator (Phase 3).
- Hints, undo/redo, peer highlighting, auto-prevention of entry (Phase 4 /
  explicitly rejected here in favour of immediate flagging).
