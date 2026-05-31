# Phase 2 — Core Playability Design

Date: 2026-05-31

## Goal

Make the game genuinely playable beyond a single hardcoded puzzle: a custom
on-screen keypad for keyboard-free / mobile play, a pencil/notes mode, new
game / reset / erase controls backed by a bundled puzzle set, and
localStorage persistence so a game resumes on refresh. Build on the Phase 1
foundation (pure logic lib + focused components) without compromising its
testability.

## Decisions

- **Interaction model:** selection-based. Click a cell to select it; the
  keypad, erase, and notes act on the selected cell. Physical-keyboard typing
  still works on the selected cell (desktop). Replaces the per-cell `<input>`
  model from Phase 1.
- **New game:** cycles through a small bundled puzzle set. The Phase 3
  generator will later replace the puzzle source without changing the UI.
- **Notes cleanup:** smart. Placing a real value clears that cell's own
  pencil marks and removes that digit from the notes of all 20 peers
  (row / column / box).
- **Keypad counts:** each keypad digit shows its remaining count and
  dims/disables at 0. The per-digit remaining list is removed from the
  StatusBar (consolidated into the keypad).
- **State location:** the reducer stays pure *game* state (the board only).
  Selection, notes-mode, and current puzzle id are ephemeral UI state in
  `Game` via `useState`. Persistence saves only `{ board, puzzleId }`.
- **Erase:** clears both the value and the notes of the selected cell.
- **Testing:** TDD with Vitest on the logic lib (reducer, puzzles, storage);
  UI verified by build + manual play, consistent with Phase 1.

## Data Model

Each cell extends from `{ value, given }` to:

```js
cell = { value: 1-9 | null, given: boolean, notes: number[] }  // index 0..80
```

- `notes` is a **sorted array** of digits 1–9 (array, not Set, so it
  serializes to JSON cleanly for persistence). Empty array when no marks.
- `createBoard(givens)` initializes every cell with `notes: []`.
- A board remains a flat, row-major array of 81 cells (indices 0..80).

UI / meta state lives in `Game` (not persisted unless noted):

- `selectedIndex: number | null` — the currently selected cell (ephemeral).
- `notesMode: boolean` — whether digit entry writes notes (ephemeral).
- `puzzleId: string` — which bundled puzzle is loaded (persisted).

## Logic Library (`app/lib/`)

Pure functions, no React. Each unit-tested.

### `reducer.js` — actions

- **`setValue({index, value})`** — sets the cell's value; clears that cell's
  own notes; removes `value` from the notes of all 20 peers. Ignores edits to
  `given` cells and out-of-range values (must be 1–9).
- **`toggleNote({index, value})`** — adds the digit to the cell's notes if
  absent, removes it if present (kept sorted). No-op on `given` cells and on
  cells that already hold a value. Ignores out-of-range values.
- **`clearCell({index})`** — erases both the value and the notes of the cell.
  No-op on `given` cells.
- **`newGame({givens})`** — builds a fresh board from a givens grid. Used for
  both "New game" and "Reset" (Reset passes the current puzzle's givens).
- **`restore({board})`** — replaces the entire board with a persisted board
  on load.

All actions remain pure and return new state without mutating the input.

### `puzzles.js` (new)

- Exports a bundled array of puzzles: `{ id, difficulty, givens }`, roughly
  6–8 entries. `givens` is a flat 81-entry grid (digit 1–9 or 0/null empty),
  matching the `createBoard` input shape.
- Helper `nextPuzzleId(currentId)` (or similar) returns a puzzle id different
  from the current one for "New game".

### `storage.js` (new)

- **`saveGame({ board, puzzleId })`** — serializes and writes to
  `localStorage` under a versioned key. Wrapped in `try/catch` (storage may be
  unavailable or full).
- **`loadGame()`** — reads and parses the saved game. Returns `null` when the
  entry is absent, unparseable, or its schema version does not match.
- Uses a guarded reference to `localStorage` so the module is import-safe on
  the server; tests inject a fake storage object.

## Components (`app/`)

- **`page.js`** (`Home`) — selects the default puzzle from `puzzles.js` and
  renders `Game`.
- **`Game.js`** — owns `board` (via `useReducer`) plus `selectedIndex`,
  `notesMode`, and `puzzleId` (`useState`). Wires keypad, controls, and
  keyboard handlers; derives conflicts / remaining / won from the lib; runs
  the persistence effects. Shows the win state when `isWon`.
- **`Board.js`** — renders the 9×9 grid of `Cell`s; passes `selectedIndex`,
  `onSelect`, the per-cell conflict flag, and notes.
- **`Cell.js`** — a `<button>` (no longer an `<input>`). Calls
  `onSelect(index)` on click. Renders the value (given vs. player color) when
  set, or a 3×3 mini-grid of pencil marks when empty and noted. Styles for
  `selected` and `conflicted` states; `given` cells are visually distinct and
  not editable.
- **`Keypad.js`** (new) — 1–9 digit buttons, each with a remaining-count
  badge, dimmed/disabled at 0; an **Erase** button; a **Notes** toggle that
  reflects active state. All act on the selected cell via handlers from
  `Game`.
- **`Controls.js`** (new) — **New game** and **Reset** buttons.
- **`StatusBar.js`** — slimmed to the conflict count only (per-digit
  remaining now lives on the keypad).

## Input Wiring

- Click a cell to select it (`selectedIndex`).
- With a cell selected:
  - keypad digit, or typed `1–9` → `setValue` (or `toggleNote` when Notes
    mode is on).
  - **Erase** button, or `Backspace` / `Delete` → `clearCell`.
- The **Notes** toggle flips `notesMode`.
- Arrow-key navigation between cells is out of scope (Phase 4); the selection
  model makes it straightforward to add later.

## Persistence Flow (SSR-safe)

- Initial render uses the default puzzle's givens — `localStorage` is not
  available during server rendering, so the first paint is deterministic and
  hydration-safe.
- On mount, a `useEffect` calls `loadGame()`; if a valid saved game exists it
  dispatches `restore({ board })` and sets `puzzleId`. Resume is silent (no
  prompt).
- A second `useEffect` calls `saveGame({ board, puzzleId })` whenever `board`
  or `puzzleId` changes.
- `selectedIndex` and `notesMode` are **not** persisted.

## Win Detection

Unchanged from Phase 1: `isWon(board)` is true when every cell is filled and
`conflicts(board)` is empty. `Game` surfaces the victory message in that
state. (Notes do not affect win detection.)

## Testing Strategy

- **TDD, Vitest, colocated `*.test.js` in `app/lib/`.** Test first, then
  implement.
- **`reducer.js`:** `setValue` (sets value, clears own notes, prunes the
  digit from peer notes, ignores givens, range checks); `toggleNote`
  (add/remove, kept sorted, no-op on given and on valued cells, range
  checks); `clearCell` (clears value and notes, no-op on given); `newGame`;
  `restore`; immutability (input state not mutated) and unknown-action no-op.
- **`board.js`:** `createBoard` initializes `notes: []`.
- **`puzzles.js`:** each bundled puzzle is well-formed — 81 entries, values in
  0–9 (or null), and no initial rule conflicts. `nextPuzzleId` returns an id
  different from the current.
- **`storage.js`:** save/load round-trip preserves board + puzzleId;
  `loadGame` returns `null` for absent / unparseable / version-mismatched
  entries (using an injected fake `localStorage`).
- **UI:** verified via `npm run build` and manual play.

## Out of Scope (later phases)

- Puzzle generator + solver with rated difficulty; "Make sudoku" entry mode
  (Phase 3).
- Styling pass, dark mode, mobile layout polish, timer, hint button,
  undo/redo, peer/same-number highlighting, arrow-key cell navigation
  (Phase 4).

## Notes on Existing Code

- `Cell.js` changes from a controlled `<input>` to a `<button>`; the
  `onSet` / `onClear` per-cell handlers are replaced by `onSelect` plus the
  keypad-driven dispatches in `Game`.
- `StatusBar.js` loses its remaining-counts block (moved to `Keypad.js`).
- No unrelated refactoring; changes stay scoped to enabling Phase 2 features.
