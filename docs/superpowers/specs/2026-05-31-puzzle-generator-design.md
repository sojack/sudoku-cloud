# Puzzle Generator + Solver Design (Phase 3, part 1)

Date: 2026-05-31

## Goal

Replace the fixed bundled puzzle set with a client-side puzzle generator backed
by a backtracking solver, and let the player pick a difficulty (Easy / Medium /
Hard) before starting a new game. Every generated puzzle has exactly one
solution. This is the first of two Phase 3 cycles; the second ("Make sudoku"
mode) reuses the solver built here.

## Decisions

- **Scope:** solver + generator + difficulty picker only. "Make sudoku" mode is
  a separate later cycle.
- **Puzzle source:** generate live in the browser on each New game; remove the
  hardcoded `PUZZLES` table entirely. No bundled fallback, no pre-generated
  pool.
- **Difficulty model:** clue-count bands (number of givens). Simple — only a
  backtracking solver is needed for uniqueness; no human-technique modelling.
  A clean seam is left so technique-grading could replace the rating later
  without changing the generator.
- **Difficulty bands (target givens):** Easy = 36, Medium = 30, Hard = 26. The
  generator digs clues away while preserving a unique solution, stopping when it
  reaches the target clue count — or earlier if no further clue can be removed
  without creating multiple solutions. So the final clue count is `>= target`
  (never fewer). See "Generator" for the exact contract.
- **Difficulty UI:** a named picker (Easy / Medium / Hard) near the controls;
  New game generates at the selected level. Default level is Medium.
- **Generation algorithm:** fill a complete valid grid (randomized
  backtracking), then dig clues in random order, keeping each removal only if
  the puzzle still has exactly one solution.
- **First load:** server renders an empty board; on mount the client generates
  a Medium puzzle (or restores a saved game). No loading indicator.
- **Persistence:** saved game becomes `{ board, solution, difficulty }` — the
  solution is stored directly (there is no longer a `puzzleId` to look it up
  from). `STORAGE_VERSION` is bumped so pre-existing saves are discarded
  cleanly.

## Consequence: deferred guard fix is dissolved

The previously-deferred `puzzleById(puzzleId).solution` guard fix is moot:
removing the `PUZZLES` table removes `puzzleById` and the `puzzleId` lookup it
guarded. The persisted solution replaces that path. The corresponding memory
note (`phase3-puzzlebyid-guard`) is deleted when this ships.

## Data Model

- A puzzle is an in-memory value: `{ givens, solution, difficulty }`.
  - `givens` — flat 81-entry array, digit 1-9 or 0 (empty), matching
    `createBoard`'s existing input shape.
  - `solution` — flat 81-entry array of digits 1-9 (the unique completion).
  - `difficulty` — one of the level keys (`'easy' | 'medium' | 'hard'`).
- The board cell shape (`{ value, given, notes }`) is unchanged.
- `createBoard(givens)` is unchanged.

## Logic Library (`app/lib/`)

Pure functions, no React, each unit-tested.

### `solver.js` (new)

- **`solve(givens)`** → a solved flat 81-array, or `null` if the givens have no
  solution. Backtracking: find the first empty cell, try digits 1-9 that do not
  conflict with the cell's row/column/box, recurse. (Conflict check is a local
  helper; reuse `grid.js` peer/row/col/box math where it keeps the code clear.)
- **`countSolutions(givens, cap = 2)`** → integer `0..cap`, the number of
  distinct solutions counted up to `cap`. Used for uniqueness checks
  (`=== 1`). Stops as soon as `cap` is reached.

### `generator.js` (new)

- **`DIFFICULTIES`** — ordered level metadata, e.g.
  `[{ key: 'easy', label: 'Easy', clues: 36 }, { key: 'medium', label: 'Medium', clues: 30 }, { key: 'hard', label: 'Hard', clues: 26 }]`.
- **`generate(difficultyKey)`** → `{ givens, solution, difficulty }`.
  1. Build a complete valid grid via randomized backtracking (shuffle the digit
     order at each step). This is the `solution`.
  2. Copy it to `givens`; visit cells in random order and tentatively clear
     each. Keep the clear only if `countSolutions(givens) === 1`; otherwise
     restore that clue. Continue until the number of remaining clues reaches the
     band's `clues` target, or no further cell can be removed.
  - **Contract:** the returned `givens` always has exactly one solution
    (`solution`), and its clue count is `>= target` (digging stops at the
    target; it may stop above the target if no more removals preserve
    uniqueness — it never goes below). `solution` is consistent with `givens`
    at every clue.
- **`randomFullGrid()`** — internal helper for step 1 (may be unexported if only
  used here; exported only if a test needs it directly).

Randomness uses `Math.random`; tests assert structural invariants (clue count,
uniqueness, consistency), not specific grids, so they remain deterministic in
outcome without seeding.

## Persistence (`app/lib/storage.js`)

- `STORAGE_VERSION` bumped to `2`.
- `saveGame({ board, solution, difficulty })` serializes
  `{ version, board, solution, difficulty }`.
- `loadGame()` returns `{ board, solution, difficulty }` or `null`
  (absent / unparseable / version mismatch). A pre-existing v1 save fails the
  version check and is treated as absent.

## Components (`app/`)

- **`page.js`** — no bundled puzzle import; renders `<Game />` (Game owns
  difficulty default). Server render shows an empty board.
- **`Game.js`** — state holds `solution` and `difficulty` (replacing
  `puzzleId`); also keeps the current `givens` so Reset can rebuild the board.
  On mount: if `loadGame()` returns a valid save, restore board + solution +
  difficulty; otherwise `generate('medium')` and initialise from it. New game:
  `generate(selectedDifficulty)`, replace board/solution/givens, clear
  selection. Reset: rebuild the board from the stored `givens`. Mistakes and win
  still derive from `solution` via the existing `mistakes`/`isSolved`.
- **`DifficultySelect.js`** (new) — Easy / Medium / Hard selector (buttons or a
  `<select>`) reflecting and setting the chosen difficulty for the next New
  game.
- **`Controls.js`** — unchanged structurally; New game button now triggers
  generation at the selected difficulty (wiring lives in `Game`).
- **`StatusBar.js` / `Board.js` / `Cell.js` / `Keypad.js`** — unchanged.

## Removed

- `app/lib/puzzles.js` and `app/lib/puzzles.test.js` (the bundled table,
  `puzzleById`, `nextPuzzleId`).
- All imports of those symbols (in `page.js` and `Game.js`).

## Initial Render / SSR

Generation uses `Math.random` and must run client-side only (never during
server render, to avoid hydration mismatch). The first paint is a deterministic
empty board; generation/restore happens in a mount effect, mirroring how the
saved-game restore already works in Phase 2.

## Testing Strategy

- **TDD, Vitest, colocated `*.test.js`.**
- **`solver.js`:** `solve` returns a valid completion for a known puzzle and
  `null` for a contradictory grid; `countSolutions` returns `1` for a uniquely
  solvable puzzle, `2` (capped) for an under-constrained grid (e.g. empty grid),
  and `0` for an unsolvable grid.
- **`generator.js`:** for each difficulty, `generate` returns `givens` of length
  81 whose clue count is `>= target`, with `countSolutions(givens) === 1`, a
  `solution` that is a valid complete grid, and `solution` consistent with
  `givens` at every clue. Run each a few times to exercise randomness.
- **`storage.js`:** round-trips `{ board, solution, difficulty }`; rejects a v1
  payload (version mismatch → null); still handles absent/unparseable.
- **UI:** verified via `npm run build` and manual play (pick a difficulty → New
  game generates a solvable puzzle of roughly the expected clue density;
  refresh resumes; Reset clears entries).

## Out of Scope (later)

- "Make sudoku" mode — enter your own givens, validate uniqueness, then play
  (next Phase 3 cycle, reuses `solver.js`).
- Technique-based difficulty grading; timer, hints, undo/redo, styling (Phase
  4).
