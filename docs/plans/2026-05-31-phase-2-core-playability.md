# Phase 2 — Core Playability Implementation Plan

## Overview

Implements Phase 2 of the Sudoku Cloud roadmap: a selection-based interaction
model with a custom 1–9 keypad, pencil/notes mode with smart cleanup, new
game / reset / erase controls backed by a bundled puzzle set, and
localStorage persistence. Builds on the Phase 1 pure-logic foundation without
compromising its testability.

Design spec: `docs/superpowers/specs/2026-05-31-phase-2-core-playability-design.md`

## Current State

- Pure logic lib in `app/lib/` (all unit-tested with Vitest):
  - `grid.js` — `rowOf`, `colOf`, `boxOf`, `peersOf(i)` (the 20 peers).
  - `board.js` — `createBoard(givens)` builds 81 cells of `{ value, given }`;
    `isEditable(board, i)`.
  - `validation.js` — `conflicts(board)` (Set of indices), `conflictCount`,
    `remainingByDigit(board)` → `{1..9: count}`, `isComplete`, `isWon`.
  - `reducer.js` — `boardReducer(state, action)` with `setCell`, `clearCell`,
    `newGame`. State is the 81-cell board array.
- Components in `app/`:
  - `page.js` — holds `DEFAULT_GIVENS`, renders `<Game givens={...} />`.
  - `Game.js` — `useReducer(boardReducer, givens, createBoard)`; derives
    `conflicts`/`remaining`/`won` via `useMemo`; passes `onSet`/`onClear` to
    `Board`; renders `StatusBar` + win message.
  - `Board.js` — maps board to `<Cell>`s, passing `conflicted={conflicts.has(i)}`.
  - `Cell.js` — a controlled `<input type="tel">`; given cells `readOnly`;
    `onChange` calls `onSet`/`onClear`.
  - `StatusBar.js` — conflict count + per-digit remaining list.
- `app/page.module.css` — `.cell` (40px), box-border `nth-child` rules,
  `.input` (player color), `.given`, `.wrong` (red), `.win`, `.status`,
  `.remaining`, `.digitDone`.
- Test command: `npm run test` (vitest run). Build: `npm run build`.
- No DOM test environment configured (lib tests are pure JS); `storage.js`
  tests will inject a fake storage object rather than rely on a DOM.

## Desired End State

- Each cell is `{ value, given, notes: number[] }`.
- Reducer supports `setValue`, `toggleNote`, `clearCell`, `newGame`, `restore`
  with smart peer-note pruning, all pure and unit-tested.
- `app/lib/puzzles.js` exports a bundled puzzle set + `nextPuzzleId`.
- `app/lib/storage.js` persists/restores `{ board, puzzleId }` safely.
- UI: click-to-select cells, on-screen keypad with remaining-count badges,
  notes toggle, erase, new game, reset; physical-keyboard entry on the
  selected cell; game auto-resumes on refresh.
- `npm run test` green; `npm run build` succeeds; manual play confirms all
  controls.

## Patterns to Follow

- **Pure-lib + TDD:** mirror Phase 1 — colocated `*.test.js`, test first.
  See `app/lib/reducer.test.js` for action-test style (`createBoard`,
  `emptyGivens()` helper, immutability assertion, unknown-action no-op).
- **Reducer immutability:** copy with `state.slice()` then replace the cell
  object (see `replaceCell` in current `reducer.js`).
- **Derived state in `Game`:** `useMemo` over the board for conflicts /
  remaining / won (see current `Game.js`).
- **CSS Modules:** add classes to `app/page.module.css`; reference via
  `styles.x`.

---

## Phase A: Data model + reducer

### Goal

Extend cells with `notes` and replace the reducer's action set with
`setValue`, `toggleNote`, `clearCell`, `newGame`, `restore`, including smart
peer-note pruning. Pure and fully unit-tested.

### Task A1: `notes` in board construction

**RED** — `app/lib/board.test.js` (add): `createBoard` initializes every cell
with `notes: []`.
- Assert `createBoard(emptyGivens())[0]` equals `{ value: null, given: false, notes: [] }`.
- Assert a given cell equals `{ value: g, given: true, notes: [] }`.

**GREEN** — `app/lib/board.js`: add `notes: []` to both branches of the
`createBoard` map.

**REFACTOR** — none expected.

### Task A2: `setValue` with smart peer-note pruning

**RED** — `app/lib/reducer.test.js` (replace `setCell` tests with `setValue`):
- Sets the value of an editable cell.
- Does not mutate the previous state.
- Ignores edits to given cells.
- Ignores out-of-range values (0, 10).
- Clears the cell's own notes when a value is placed (seed the cell's `notes`
  first, e.g. via `toggleNote`, then `setValue`, expect `notes: []`).
- Removes the placed digit from peers' notes but leaves other peer notes and
  non-peer notes untouched. (Set up: put note `5` in a peer of index 0 and in
  a non-peer; `setValue` index 0 to 5; expect peer note gone, non-peer note
  kept. Use `peersOf` to pick a known peer, e.g. index 1.)

**GREEN** — `app/lib/reducer.js`: implement `case 'setValue'`:
- Guard `state[index].given` and `value` in 1–9.
- Build next board: copy array; set target cell `{ ...cell, value, notes: [] }`;
  for each `p` in `peersOf(index)`, if its notes include `value`, replace with
  notes filtered to exclude `value`.
- Import `peersOf` from `./grid`.

**REFACTOR** — extract a helper for "replace several cells immutably" if it
clarifies; keep pure.

### Task A3: `toggleNote`

**RED** — `app/lib/reducer.test.js`:
- Adds a digit to an empty cell's notes (absent → present).
- Removes it when already present (toggle off).
- Keeps notes sorted ascending (toggle 7 then 3 → `[3, 7]`).
- No-op on given cells.
- No-op on cells that already hold a value.
- Ignores out-of-range values.
- Does not mutate previous state.

**GREEN** — `app/lib/reducer.js`: `case 'toggleNote'`:
- Guard given, value 1–9, and `state[index].value == null`.
- Toggle membership in a copy of `notes`; keep sorted.

**REFACTOR** — none expected.

### Task A4: `clearCell` clears value and notes

**RED** — `app/lib/reducer.test.js` (update existing `clearCell` tests):
- Clears value of a valued cell.
- Clears notes of a noted (but value-less) cell.
- No-op on given cells.
- Does not mutate previous state.

**GREEN** — `app/lib/reducer.js`: `case 'clearCell'` returns the cell with
`{ ...cell, value: null, notes: [] }` (guard given).

### Task A5: `newGame` and `restore`

**RED** — `app/lib/reducer.test.js`:
- `newGame`: builds a fresh board from new givens (existing test; assert the
  cell now includes `notes: []`).
- `restore`: `boardReducer(state, { type: 'restore', board })` returns exactly
  `board`.
- Unknown action returns the same state reference (existing test).

**GREEN** — `app/lib/reducer.js`: keep `case 'newGame'` (uses updated
`createBoard`); add `case 'restore': return action.board`.

### Verification (Phase A)
- [ ] `npm run test` — all lib tests green, including new reducer/board tests.
- [ ] No remaining references to the old `setCell` action in the lib.

---

## Phase B: Bundled puzzles

### Goal

Provide a small bundled puzzle set and a helper to pick the next puzzle.

### Task B1: puzzle data + `nextPuzzleId`

**RED** — `app/lib/puzzles.test.js` (new):
- `PUZZLES` has at least 6 entries; each has `id` (string), `difficulty`
  (string), and `givens` (length 81).
- Each puzzle's `givens` contains only integers 0–9 (treat null as 0 if used).
- Each puzzle has no initial conflicts: `conflicts(createBoard(givens)).size === 0`
  (import `createBoard`, `conflicts`).
- All `id`s are unique.
- `nextPuzzleId(currentId)` returns an id present in `PUZZLES` and different
  from `currentId`.

**GREEN** — `app/lib/puzzles.js` (new):
- Export `PUZZLES = [{ id, difficulty, givens }, ...]` (~6–8 valid puzzles;
  reuse the current `DEFAULT_GIVENS` as one entry). Each `givens` a flat
  81-entry array (0 = empty).
- Export `nextPuzzleId(currentId)` returning the next id cyclically (or a
  random id ≠ current). Keep deterministic-enough to test (cyclic is simplest).

**REFACTOR** — none expected.

### Verification (Phase B)
- [ ] `npm run test` — puzzle tests green (well-formedness + no conflicts).

---

## Phase C: Persistence

### Goal

Save/restore `{ board, puzzleId }` to localStorage safely and SSR-compatibly.

### Task C1: `saveGame` / `loadGame`

**RED** — `app/lib/storage.test.js` (new), using an injected fake storage:
- Design `storage.js` so the storage object is resolvable for tests — e.g.
  accept an optional storage arg defaulting to `globalThis.localStorage`, or
  read `globalThis.localStorage` and have the test assign a fake to it in
  `beforeEach`. (Pick the optional-arg form; it's the cleanest to test.)
- Round-trip: `saveGame(state, fake)` then `loadGame(fake)` deep-equals the
  saved `{ board, puzzleId }`.
- `loadGame` returns `null` when the key is absent.
- `loadGame` returns `null` when the stored value is unparseable JSON.
- `loadGame` returns `null` when the stored schema `version` differs from the
  current version.
- `saveGame` does not throw when the storage setter throws (simulate a fake
  whose `setItem` throws).

**GREEN** — `app/lib/storage.js` (new):
- `const KEY = 'sudoku-cloud:game'`, `const VERSION = 1`.
- `saveGame({ board, puzzleId }, storage = globalThis.localStorage)` —
  guard `if (!storage) return`; `try { storage.setItem(KEY, JSON.stringify({ version: VERSION, board, puzzleId })) } catch {}`.
- `loadGame(storage = globalThis.localStorage)` — guard missing storage; read,
  `JSON.parse` in try/catch; return `null` unless parsed and
  `parsed.version === VERSION`; else return `{ board: parsed.board, puzzleId: parsed.puzzleId }`.

**REFACTOR** — none expected.

### Verification (Phase C)
- [ ] `npm run test` — storage tests green.

---

## Phase D: UI rewiring (selection model, keypad, controls)

No new unit tests (consistent with Phase 1: UI verified by build + manual
play). Build incrementally and keep `npm run build` green between steps.

### Task D1: `Cell` becomes a selectable button

#### `app/Cell.js`
- Replace the `<input>` implementation with a `<button type="button">`.
- Props: `cell`, `index`, `conflicted`, `selected`, `onSelect`.
- `onClick={() => onSelect(index)}`.
- Render logic:
  - If `cell.value != null`: render the digit; class `given` vs `input`.
  - Else if `cell.notes.length`: render a 3×3 notes grid — a `<span>` per
    digit 1–9, showing the digit only when in `cell.notes` (empty slot
    otherwise) so positions stay fixed.
  - Else: empty.
- Class string includes `selected` and `wrong` (when `conflicted`).

#### `app/page.module.css`
- Keep `.cell` sizing/borders; ensure they apply to a `<button>` (reset
  default button background/border via the existing border rules; add
  `background: none; cursor: pointer; padding: 0`).
- Add `.selected` (e.g. background highlight).
- Add `.notes` (3×3 grid: `display: grid; grid-template-columns: repeat(3, 1fr);`
  small font, muted color) and a `.noteCell` for each slot.

### Task D2: `Board` passes selection through

#### `app/Board.js`
- Props: add `selectedIndex`, `onSelect` (drop `onSet`/`onClear`).
- Pass `selected={i === selectedIndex}` and `onSelect` to each `Cell`.

### Task D3: `Keypad` component

#### `app/Keypad.js` (new)
- Props: `remaining` (`{1..9: count}`), `notesMode`, `onDigit(d)`,
  `onErase()`, `onToggleNotes()`.
- Render 1–9 buttons; each shows the digit and a small remaining badge
  (`remaining[d]`); add `disabled` and a dimmed class when `remaining[d] === 0`.
- An **Erase** button → `onErase`.
- A **Notes** toggle button → `onToggleNotes`; reflect `notesMode` with an
  active class.

#### `app/page.module.css`
- Add `.keypad` (grid/flex layout), `.key`, `.keyBadge`, `.keyDisabled`,
  `.notesToggle`, `.notesActive`.

### Task D4: `Controls` component

#### `app/Controls.js` (new)
- Props: `onNewGame()`, `onReset()`.
- Two buttons: **New game**, **Reset**.

#### `app/page.module.css`
- Add `.controls` layout + `.controlBtn` styling.

### Task D5: `StatusBar` slimmed

#### `app/StatusBar.js`
- Remove the per-digit remaining block; keep the conflict count only.
- Drop the `remaining` prop.

### Task D6: `Game` wiring + persistence

#### `app/Game.js`
- Props change: accept `{ puzzle }` (a `{ id, givens }`) instead of raw
  `givens`, or accept both `puzzleId` + `givens`. (Choose `puzzle`.)
- State:
  - `const [board, dispatch] = useReducer(boardReducer, puzzle.givens, createBoard)`.
  - `const [selectedIndex, setSelectedIndex] = useState(null)`.
  - `const [notesMode, setNotesMode] = useState(false)`.
  - `const [puzzleId, setPuzzleId] = useState(puzzle.id)`.
- Derived: keep `conflicts`, `remaining`, `won` via `useMemo`.
- Handlers:
  - `handleSelect(index)` → `setSelectedIndex(index)`.
  - `handleDigit(d)` → if `selectedIndex == null` return; if `notesMode`
    dispatch `toggleNote`, else `setValue`.
  - `handleErase()` → if `selectedIndex != null` dispatch `clearCell`.
  - `handleNewGame()` → `const id = nextPuzzleId(puzzleId)`; look up its givens
    from `PUZZLES`; `dispatch({ type: 'newGame', givens })`; `setPuzzleId(id)`;
    `setSelectedIndex(null)`.
  - `handleReset()` → look up current puzzle's givens; `dispatch newGame` with
    them; `setSelectedIndex(null)`.
- Keyboard: a `useEffect` adding a `keydown` listener — `1`–`9` → `handleDigit`;
  `Backspace`/`Delete` → `handleErase`; ignore when `selectedIndex == null`.
  Clean up on unmount.
- Persistence:
  - On mount `useEffect`: `const saved = loadGame()`; if present, `dispatch({ type: 'restore', board: saved.board })` and `setPuzzleId(saved.puzzleId)`.
  - Save `useEffect` keyed on `[board, puzzleId]`: `saveGame({ board, puzzleId })`.
- Render: `StatusBar` (conflict count), win message, `Board`
  (`selectedIndex`, `onSelect`), `Keypad`, `Controls`.

#### `app/page.js`
- Import `PUZZLES` from `./lib/puzzles`; pass `puzzle={PUZZLES[0]}` to `Game`.
- Remove the local `DEFAULT_GIVENS` (now sourced from `puzzles.js`).

### Verification (Phase D)
- [ ] `npm run build` succeeds.
- [ ] `npm run dev` and manually verify:
  - Click a cell → it highlights as selected.
  - Keypad digit / typed digit fills the selected cell; given cells never change.
  - Notes toggle on → digits enter as pencil marks (3×3 in the cell); placing a
    real value clears the cell's notes and removes that digit from peer notes.
  - Erase / Backspace clears the selected cell (value and notes).
  - Keypad badges show remaining counts and dim at 0.
  - Conflicts still highlight red; win message shows on a correct full board.
  - New game loads a different bundled puzzle; Reset clears entries on the
    current puzzle.
  - Refresh the page → the in-progress game (values + notes + puzzle) resumes.

---

## Testing Strategy

- **Unit (Vitest, TDD):** Phases A–C — board, reducer, puzzles, storage.
  Run `npm run test` after each task; keep green.
- **Build:** `npm run build` after each Phase D task.
- **Manual play:** the Phase D verification checklist above.

## Rollback Plan

- Work on a feature branch; each phase is a separate commit. Revert the
  branch or individual commits if needed. No data migrations — persisted
  state is namespaced under a versioned key, so an incompatible change simply
  fails `loadGame`'s version check and falls back to a fresh default puzzle.

## Out of Scope (later phases)

Puzzle generator/solver + "Make sudoku" (Phase 3); styling pass, dark mode,
mobile polish, timer, hints, undo/redo, peer/same-number highlighting,
arrow-key navigation (Phase 4).
