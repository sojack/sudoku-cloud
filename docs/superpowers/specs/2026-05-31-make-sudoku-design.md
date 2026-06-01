# "Make Sudoku" Mode Design (Phase 3, part 2)

Date: 2026-05-31

## Goal

Let the player enter their own puzzle by hand, validate that it has exactly one
solution, then play it with the normal mistake-checking and win detection. This
is the second and final Phase 3 cycle; it reuses the `solver.js` built in part 1
and completes the "Puzzle variety" roadmap item.

## Decisions

- **Entry flow:** enter, then click **Start** to lock. Clicking *Make sudoku*
  clears the board to an empty, fully-editable grid; the player types the
  givens; **Start** validates and (if valid) locks them and switches to play.
- **Validation on Start:** block and explain if the puzzle is not uniquely
  solvable. Distinguish "no solution" (contradictory givens) from "multiple
  solutions — add more clues". The player keeps editing until it is unique.
- **Mode entry UI:** a *Make sudoku* button alongside *New game* / *Reset* in
  the controls. The difficulty picker is hidden while making (difficulty does
  not apply to a hand-entered puzzle).
- **Cancel:** an explicit way to back out of entry without committing. Cancel
  discards the entry and restores the previous real game (saved game if present,
  otherwise a freshly generated default puzzle — the same path as first load).
- **Persistence:** once Started, a hand-entered puzzle saves and resumes on
  refresh exactly like a generated one (board + its solution). Mid-entry state
  (before Start) is never saved; a refresh during entry resumes the last real
  game or generates fresh.
- **State architecture:** a `mode: 'play' | 'make'` flag in `Game`. The pure
  board reducer and the Board/Cell/Keypad components are reused unchanged.

## Logic Library (`app/lib/`)

### `makepuzzle.js` (new)

Pure, unit-tested. Wraps the existing solver.

- **`validatePuzzle(givens)`** → one of:
  - `{ status: 'unique', solution }` — exactly one solution; `solution` is the
    solved 81-array.
  - `{ status: 'none' }` — no solution (contradictory or unsatisfiable givens).
  - `{ status: 'multiple' }` — two or more solutions (under-constrained).
  - Implementation: `const n = countSolutions(givens, 2)`; `0 → none`,
    `2 → multiple`, `1 → { unique, solution: solve(givens) }`. `givens` is a
    flat 81-entry array with `0` for empty (the existing givens shape).

No change to `solver.js`, `generator.js`, `validation.js`, `reducer.js`, or
`board.js`.

## Game State (`app/Game.js`)

Adds:
- `mode: 'play' | 'make'` (default `'play'`).
- `makeMessage: string | null` — validation feedback shown during entry.

Behaviour:
- **Enter make mode** (*Make sudoku* button, only shown in `play`): set
  `mode='make'`; reset the board to an all-empty editable grid
  (`newGame` with empty givens); clear `selectedIndex`, `makeMessage`, and turn
  `notesMode` off. `solution` is irrelevant in make mode (set to the empty
  array / not used).
- **During entry** (`mode==='make'`): cells are entered as plain values (all
  editable, none `given`). Mistake-flagging is off (the Board receives an empty
  mistakes set). The StatusBar's mistake count is hidden. Notes are disabled.
  Erase / Backspace / Delete clear a cell. The difficulty picker is not
  rendered.
- **Start** (shown only in `make`): build a givens grid from the current board
  values (cell value or 0); call `validatePuzzle`:
  - `none` → `makeMessage = 'No solution — check your clues.'`; stay in make
    mode.
  - `multiple` → `makeMessage = 'Multiple solutions — add more clues.'`; stay in
    make mode.
  - `unique` → rebuild the board from those givens via `newGame` (entered cells
    become `given`), set `solution`, set `mode='play'`, clear `makeMessage` and
    `selectedIndex`. Normal play resumes; the save effect persists it.
- **Cancel** (shown only in `make`): set `mode='play'`, clear `makeMessage` and
  `selectedIndex`, and restore the previous game — `loadGame()` if a valid save
  exists (restore board + solution + difficulty), else `generate(difficulty)`
  with the current difficulty. (Reuse the mount restore-or-generate logic;
  factor it into a helper the mount effect and Cancel both call.)
- **Persistence guard:** the save effect only runs in `play` mode (and when
  `ready`). It must not save during `make` (so a mid-entry board never
  overwrites the saved game). On Start, the transition to `play` plus the new
  board triggers a normal save.
- **Win/mistakes:** unchanged in `play`. In `make`, `won` is forced false and
  the mistakes set is empty (no solution to compare against).

## Components (`app/`)

- **`Controls.js`** — in `play` mode shows *New game*, *Reset*, *Make sudoku*.
  In `make` mode shows *Start* and *Cancel*. Driven by a `mode` prop plus
  `onMakeSudoku` / `onStart` / `onCancel` handlers from `Game` (alongside the
  existing `onNewGame` / `onReset`).
- **`Game.js`** — renders the validation message (when `makeMessage` is set)
  near the controls using existing text styling; passes `mode` and the new
  handlers to `Controls`; renders `DifficultySelect` only when `mode==='play'`;
  passes an empty mistakes set and `mistakeCount` hidden in make mode.
- **`StatusBar.js`** — accepts the mode (or simply receives `mistakeCount={null}`
  / a hidden flag in make mode) so it shows nothing to check while entering.
  Keep the change minimal: hide the mistakes line in make mode.
- **`Board.js` / `Cell.js` / `Keypad.js` / `DifficultySelect.js`** — unchanged.

## Validation Messaging

- Distinct copy: `'No solution — check your clues.'` vs
  `'Multiple solutions — add more clues.'`.
- Shown only in `make` mode after a failed Start; cleared on a successful Start
  or on Cancel.

## Persistence

No storage-shape change. `saveGame({ board, solution, difficulty })` /
`loadGame()` (v2) are reused as-is. The only new rule is that saving is
suppressed while `mode==='make'`.

## Testing Strategy

- **TDD, Vitest, colocated `*.test.js`.**
- **`makepuzzle.js`:** `validatePuzzle` returns `unique` with a `solution`
  consistent with the givens for a known uniquely-solvable puzzle; `none` for a
  contradictory grid (e.g. two identical digits in a row); `multiple` for an
  under-constrained grid (e.g. an almost-empty or fully-empty grid).
- **UI / mode transitions:** verified via `npm run build` and manual play —
  enter make mode, type a known unique puzzle → Start locks and plays; type a
  contradictory grid → "No solution"; type too few clues → "Multiple
  solutions"; Cancel returns to the prior game; refresh after Start resumes the
  hand-entered puzzle; refresh during entry resumes the prior game.

## Out of Scope

- Importing/sharing puzzles by code or URL.
- Re-validating uniqueness of generated puzzles (already guaranteed by the
  generator).
- Phase 4 polish: timer, hints, undo/redo, peer highlighting, styling, mobile.
