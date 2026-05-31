# Phase 2 — Core Playability Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Sudoku Cloud genuinely playable — selection-based input with a custom 1–9 keypad, pencil/notes mode with smart cleanup, new game / reset / erase controls over a bundled puzzle set, and localStorage resume-on-refresh.

**Architecture:** Keep the reducer as pure *game* state (the 81-cell board, cells now `{ value, given, notes }`). Selection, notes-mode, and current puzzle id are ephemeral UI state in `Game` via `useState`. New lib modules `puzzles.js` (bundled set) and `storage.js` (versioned localStorage) stay pure and unit-tested. UI is rebuilt around click-to-select cells + a keypad/controls; verified by build + manual play.

**Tech Stack:** Next.js 16 (App Router) + React 19, CSS Modules, Vitest.

Design spec: `docs/superpowers/specs/2026-05-31-phase-2-core-playability-design.md`

---

## Current State (read before starting)

- Pure logic lib `app/lib/` (all unit-tested):
  - `grid.js` — `rowOf`, `colOf`, `boxOf`, `peersOf(i)` (the 20 peers of `i`).
  - `board.js` — `createBoard(givens)` → 81 cells of `{ value, given }`; `isEditable`.
  - `validation.js` — `conflicts(board)` (Set), `conflictCount`, `remainingByDigit` → `{1..9: count}`, `isComplete`, `isWon`.
  - `reducer.js` — `boardReducer(state, action)`; actions `setCell`, `clearCell`, `newGame`; state is the board array; uses `replaceCell(state, index, value)` helper.
- Components `app/`: `page.js` (holds `DEFAULT_GIVENS`, renders `<Game givens>`), `Game.js` (`useReducer` + `useMemo` derivations, passes `onSet`/`onClear`), `Board.js` (maps to `Cell`s), `Cell.js` (controlled `<input type="tel">`), `StatusBar.js` (conflict count + remaining list).
- `app/page.module.css` — `.cell` (40px), box-border `nth-child` rules, `.input`, `.given`, `.wrong` (red), `.win`, `.status`, `.remaining`, `.digitDone`, `.board`, `.game`, `.main`.
- Commands: `npm run test` (vitest run), `npm run test:watch`, `npm run build`, `npm run dev`.
- No DOM test env configured — lib tests are pure JS. `storage.js` tests inject a fake storage object (an optional arg), so no DOM is needed.

## File Structure (created / modified)

- `app/lib/board.js` (modify) — add `notes: []` to cells.
- `app/lib/board.test.js` (modify) — assert notes init.
- `app/lib/reducer.js` (modify) — replace actions with `setValue`, `toggleNote`, `clearCell`, `newGame`, `restore`.
- `app/lib/reducer.test.js` (modify) — tests for new actions.
- `app/lib/puzzles.js` (create) — `PUZZLES`, `nextPuzzleId`, `puzzleById`.
- `app/lib/puzzles.test.js` (create) — well-formedness + helpers.
- `app/lib/storage.js` (create) — `saveGame`, `loadGame`.
- `app/lib/storage.test.js` (create) — round-trip + failure modes.
- `app/Cell.js` (rewrite) — selectable `<button>` with value or 3×3 notes.
- `app/Board.js` (modify) — pass `selectedIndex` / `onSelect`.
- `app/Keypad.js` (create) — 1–9 with remaining badges, erase, notes toggle.
- `app/Controls.js` (create) — New game / Reset.
- `app/StatusBar.js` (modify) — conflict count only.
- `app/Game.js` (rewrite) — selection/notes/puzzle state, handlers, keyboard, persistence.
- `app/page.js` (modify) — source the puzzle from `puzzles.js`.
- `app/page.module.css` (modify) — selected, notes grid, keypad, controls styles.

---

## Task 1: Cells carry `notes`

**Files:**
- Modify: `app/lib/board.js`
- Test: `app/lib/board.test.js`

- [ ] **Step 1: Write the failing test** — add to `app/lib/board.test.js`:

```js
it('initializes every cell with an empty notes array', () => {
  const givens = Array(81).fill(null)
  givens[0] = 3
  const board = createBoard(givens)
  expect(board[0]).toEqual({ value: 3, given: true, notes: [] })
  expect(board[1]).toEqual({ value: null, given: false, notes: [] })
})
```

- [ ] **Step 2: Run test, verify it fails**

Run: `npm run test -- board`
Expected: FAIL (cells lack `notes`).

- [ ] **Step 3: Implement** — in `app/lib/board.js`, add `notes: []` to both branches:

```js
export function createBoard(givens) {
  return givens.map((g) => {
    const filled = typeof g === 'number' && g >= 1 && g <= 9
    return filled
      ? { value: g, given: true, notes: [] }
      : { value: null, given: false, notes: [] }
  })
}
```

- [ ] **Step 4: Run test, verify it passes**

Run: `npm run test -- board`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add app/lib/board.js app/lib/board.test.js
git commit -m "Add notes field to board cells"
```

---

## Task 2: `setValue` action with smart peer-note pruning

**Files:**
- Modify: `app/lib/reducer.js`
- Test: `app/lib/reducer.test.js`

- [ ] **Step 1: Write the failing tests** — in `app/lib/reducer.test.js`, replace the `setCell` describe block with:

```js
describe('boardReducer - setValue', () => {
  it('sets the value of an editable cell', () => {
    const state = createBoard(emptyGivens())
    const next = boardReducer(state, { type: 'setValue', index: 0, value: 5 })
    expect(next[0].value).toBe(5)
  })

  it('does not mutate the previous state', () => {
    const state = createBoard(emptyGivens())
    boardReducer(state, { type: 'setValue', index: 0, value: 5 })
    expect(state[0].value).toBe(null)
  })

  it('ignores edits to given cells', () => {
    const givens = emptyGivens()
    givens[0] = 3
    const state = createBoard(givens)
    const next = boardReducer(state, { type: 'setValue', index: 0, value: 9 })
    expect(next[0].value).toBe(3)
  })

  it('ignores out-of-range values', () => {
    const state = createBoard(emptyGivens())
    expect(boardReducer(state, { type: 'setValue', index: 0, value: 0 })[0].value).toBe(null)
    expect(boardReducer(state, { type: 'setValue', index: 0, value: 10 })[0].value).toBe(null)
  })

  it("clears the cell's own notes when a value is placed", () => {
    let state = createBoard(emptyGivens())
    state = boardReducer(state, { type: 'toggleNote', index: 0, value: 4 })
    const next = boardReducer(state, { type: 'setValue', index: 0, value: 5 })
    expect(next[0].notes).toEqual([])
  })

  it('removes the placed digit from peers notes but leaves others', () => {
    // index 1 is a peer of index 0 (same row); index 80 is not a peer of 0.
    let state = createBoard(emptyGivens())
    state = boardReducer(state, { type: 'toggleNote', index: 1, value: 5 })
    state = boardReducer(state, { type: 'toggleNote', index: 1, value: 6 })
    state = boardReducer(state, { type: 'toggleNote', index: 80, value: 5 })
    const next = boardReducer(state, { type: 'setValue', index: 0, value: 5 })
    expect(next[1].notes).toEqual([6])   // 5 pruned, 6 kept
    expect(next[80].notes).toEqual([5])  // non-peer untouched
  })
})
```

- [ ] **Step 2: Run test, verify it fails**

Run: `npm run test -- reducer`
Expected: FAIL (no `setValue` / `toggleNote` cases yet).

- [ ] **Step 3: Implement** — in `app/lib/reducer.js`, add the import and the case. Replace the `setCell` case with `setValue`:

```js
import { createBoard } from './board'
import { peersOf } from './grid'

// ...inside switch:
case 'setValue': {
  const { index, value } = action
  if (state[index].given) return state
  if (!(value >= 1 && value <= 9)) return state
  const next = state.slice()
  next[index] = { ...next[index], value, notes: [] }
  for (const p of peersOf(index)) {
    if (next[p].notes.includes(value)) {
      next[p] = { ...next[p], notes: next[p].notes.filter((n) => n !== value) }
    }
  }
  return next
}
```

(Leave `clearCell`, `newGame`, `default` for now; `toggleNote` is added in Task 3. The "clears own notes" test depends on Task 3 — it will pass once Task 3 lands; the other `setValue` tests pass now.)

- [ ] **Step 4: Run test**

Run: `npm run test -- reducer`
Expected: the four non-note `setValue` tests PASS; the two note-dependent ones may FAIL until Task 3 adds `toggleNote`. That is expected — proceed.

- [ ] **Step 5: Commit**

```bash
git add app/lib/reducer.js app/lib/reducer.test.js
git commit -m "Add setValue reducer action with peer-note pruning"
```

---

## Task 3: `toggleNote` action

**Files:**
- Modify: `app/lib/reducer.js`
- Test: `app/lib/reducer.test.js`

- [ ] **Step 1: Write the failing tests** — add to `app/lib/reducer.test.js`:

```js
describe('boardReducer - toggleNote', () => {
  it('adds a digit to an empty cell notes', () => {
    const state = createBoard(emptyGivens())
    const next = boardReducer(state, { type: 'toggleNote', index: 0, value: 4 })
    expect(next[0].notes).toEqual([4])
  })

  it('removes a digit that is already present', () => {
    let state = createBoard(emptyGivens())
    state = boardReducer(state, { type: 'toggleNote', index: 0, value: 4 })
    const next = boardReducer(state, { type: 'toggleNote', index: 0, value: 4 })
    expect(next[0].notes).toEqual([])
  })

  it('keeps notes sorted ascending', () => {
    let state = createBoard(emptyGivens())
    state = boardReducer(state, { type: 'toggleNote', index: 0, value: 7 })
    const next = boardReducer(state, { type: 'toggleNote', index: 0, value: 3 })
    expect(next[0].notes).toEqual([3, 7])
  })

  it('is a no-op on given cells', () => {
    const givens = emptyGivens()
    givens[0] = 3
    const state = createBoard(givens)
    const next = boardReducer(state, { type: 'toggleNote', index: 0, value: 4 })
    expect(next[0].notes).toEqual([])
  })

  it('is a no-op on cells that already hold a value', () => {
    let state = createBoard(emptyGivens())
    state = boardReducer(state, { type: 'setValue', index: 0, value: 5 })
    const next = boardReducer(state, { type: 'toggleNote', index: 0, value: 4 })
    expect(next[0].notes).toEqual([])
  })

  it('ignores out-of-range values', () => {
    const state = createBoard(emptyGivens())
    expect(boardReducer(state, { type: 'toggleNote', index: 0, value: 0 })[0].notes).toEqual([])
    expect(boardReducer(state, { type: 'toggleNote', index: 0, value: 10 })[0].notes).toEqual([])
  })

  it('does not mutate the previous state', () => {
    const state = createBoard(emptyGivens())
    boardReducer(state, { type: 'toggleNote', index: 0, value: 4 })
    expect(state[0].notes).toEqual([])
  })
})
```

- [ ] **Step 2: Run test, verify it fails**

Run: `npm run test -- reducer`
Expected: FAIL (no `toggleNote` case).

- [ ] **Step 3: Implement** — add the case to `app/lib/reducer.js`:

```js
case 'toggleNote': {
  const { index, value } = action
  if (state[index].given) return state
  if (state[index].value != null) return state
  if (!(value >= 1 && value <= 9)) return state
  const notes = state[index].notes
  const nextNotes = notes.includes(value)
    ? notes.filter((n) => n !== value)
    : [...notes, value].sort((a, b) => a - b)
  const next = state.slice()
  next[index] = { ...next[index], notes: nextNotes }
  return next
}
```

- [ ] **Step 4: Run test, verify it passes**

Run: `npm run test -- reducer`
Expected: PASS — including the two note-dependent `setValue` tests from Task 2.

- [ ] **Step 5: Commit**

```bash
git add app/lib/reducer.js app/lib/reducer.test.js
git commit -m "Add toggleNote reducer action"
```

---

## Task 4: `clearCell` clears value and notes; keep `newGame`; add `restore`

**Files:**
- Modify: `app/lib/reducer.js`
- Test: `app/lib/reducer.test.js`

- [ ] **Step 1: Write the failing tests** — in `app/lib/reducer.test.js`, replace the `clearCell` describe block and add a `restore` block:

```js
describe('boardReducer - clearCell', () => {
  it('clears the value of a valued cell', () => {
    let state = createBoard(emptyGivens())
    state = boardReducer(state, { type: 'setValue', index: 0, value: 5 })
    const next = boardReducer(state, { type: 'clearCell', index: 0 })
    expect(next[0].value).toBe(null)
  })

  it('clears the notes of a noted cell', () => {
    let state = createBoard(emptyGivens())
    state = boardReducer(state, { type: 'toggleNote', index: 0, value: 4 })
    const next = boardReducer(state, { type: 'clearCell', index: 0 })
    expect(next[0].notes).toEqual([])
  })

  it('does not clear given cells', () => {
    const givens = emptyGivens()
    givens[0] = 3
    const state = createBoard(givens)
    const next = boardReducer(state, { type: 'clearCell', index: 0 })
    expect(next[0].value).toBe(3)
  })
})

describe('boardReducer - restore', () => {
  it('replaces the board with the provided board', () => {
    const state = createBoard(emptyGivens())
    const board = createBoard(emptyGivens())
    board[40] = { value: 6, given: false, notes: [] }
    const next = boardReducer(state, { type: 'restore', board })
    expect(next).toBe(board)
  })
})
```

(The existing `newGame` and unknown-action describe blocks stay; update the `newGame` assertion to `expect(next[40]).toEqual({ value: 6, given: true, notes: [] })`.)

- [ ] **Step 2: Run test, verify it fails**

Run: `npm run test -- reducer`
Expected: FAIL (clearCell doesn't clear notes; no `restore` case).

- [ ] **Step 3: Implement** — in `app/lib/reducer.js`, update `clearCell` and add `restore`:

```js
case 'clearCell': {
  const { index } = action
  if (state[index].given) return state
  const next = state.slice()
  next[index] = { ...next[index], value: null, notes: [] }
  return next
}

case 'newGame':
  return createBoard(action.givens)

case 'restore':
  return action.board
```

Remove the now-unused `replaceCell` helper if nothing references it.

- [ ] **Step 4: Run test, verify it passes**

Run: `npm run test -- reducer`
Expected: PASS (all reducer + board tests).

- [ ] **Step 5: Commit**

```bash
git add app/lib/reducer.js app/lib/reducer.test.js
git commit -m "Erase clears value and notes; add restore action"
```

---

## Task 5: Bundled puzzles

**Files:**
- Create: `app/lib/puzzles.js`
- Test: `app/lib/puzzles.test.js`

- [ ] **Step 1: Write the failing test** — create `app/lib/puzzles.test.js`:

```js
import { describe, it, expect } from 'vitest'
import { PUZZLES, nextPuzzleId, puzzleById } from './puzzles'
import { createBoard } from './board'
import { conflicts } from './validation'

describe('PUZZLES', () => {
  it('has at least 6 puzzles', () => {
    expect(PUZZLES.length).toBeGreaterThanOrEqual(6)
  })

  it('each puzzle is well-formed', () => {
    for (const p of PUZZLES) {
      expect(typeof p.id).toBe('string')
      expect(typeof p.difficulty).toBe('string')
      expect(p.givens).toHaveLength(81)
      for (const g of p.givens) {
        expect(Number.isInteger(g)).toBe(true)
        expect(g).toBeGreaterThanOrEqual(0)
        expect(g).toBeLessThanOrEqual(9)
      }
    }
  })

  it('no puzzle has initial conflicts', () => {
    for (const p of PUZZLES) {
      expect(conflicts(createBoard(p.givens)).size).toBe(0)
    }
  })

  it('all ids are unique', () => {
    const ids = PUZZLES.map((p) => p.id)
    expect(new Set(ids).size).toBe(ids.length)
  })
})

describe('nextPuzzleId / puzzleById', () => {
  it('returns an existing id different from the current', () => {
    const id = nextPuzzleId(PUZZLES[0].id)
    expect(id).not.toBe(PUZZLES[0].id)
    expect(PUZZLES.some((p) => p.id === id)).toBe(true)
  })

  it('puzzleById returns the matching puzzle', () => {
    const p = PUZZLES[0]
    expect(puzzleById(p.id)).toBe(p)
  })
})
```

- [ ] **Step 2: Run test, verify it fails**

Run: `npm run test -- puzzles`
Expected: FAIL (module not found).

- [ ] **Step 3: Implement** — create `app/lib/puzzles.js` with 6–8 valid puzzles (each `givens` a flat 81-entry array, 0 = empty). Use the existing default puzzle from `app/page.js` as `easy-1`, and add more (any known-valid, conflict-free Sudoku givens). Skeleton:

```js
// Bundled puzzles. givens is a flat row-major 81-entry grid (0 = empty).
export const PUZZLES = [
  {
    id: 'easy-1',
    difficulty: 'easy',
    givens: [
      7, 2, 0, 0, 0, 0, 0, 0, 0,
      0, 5, 0, 0, 0, 9, 0, 0, 0,
      0, 0, 0, 0, 3, 8, 0, 0, 0,
      0, 0, 0, 4, 0, 0, 5, 0, 0,
      0, 0, 3, 0, 0, 0, 9, 0, 0,
      0, 0, 1, 0, 0, 3, 0, 0, 0,
      0, 0, 0, 2, 5, 0, 0, 0, 0,
      0, 0, 0, 6, 0, 0, 0, 3, 0,
      0, 0, 0, 0, 0, 0, 0, 1, 9,
    ],
  },
  // ...add at least five more conflict-free puzzles with unique ids...
]

export function puzzleById(id) {
  return PUZZLES.find((p) => p.id === id)
}

export function nextPuzzleId(currentId) {
  const i = PUZZLES.findIndex((p) => p.id === currentId)
  const nextIndex = (i + 1) % PUZZLES.length
  // guard the single-puzzle edge case (won't happen with >=6)
  return PUZZLES[nextIndex].id
}
```

Note for the implementer: when adding puzzles, confirm each is conflict-free — the test `no puzzle has initial conflicts` enforces this. Source givens from any standard puzzle bank; do not invent rows by hand without checking.

- [ ] **Step 4: Run test, verify it passes**

Run: `npm run test -- puzzles`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add app/lib/puzzles.js app/lib/puzzles.test.js
git commit -m "Add bundled puzzle set"
```

---

## Task 6: localStorage persistence

**Files:**
- Create: `app/lib/storage.js`
- Test: `app/lib/storage.test.js`

- [ ] **Step 1: Write the failing test** — create `app/lib/storage.test.js`:

```js
import { describe, it, expect, beforeEach } from 'vitest'
import { saveGame, loadGame, STORAGE_KEY, STORAGE_VERSION } from './storage'

function fakeStorage(initial = {}) {
  const map = new Map(Object.entries(initial))
  return {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => map.set(k, v),
    removeItem: (k) => map.delete(k),
  }
}

describe('storage', () => {
  let store
  beforeEach(() => {
    store = fakeStorage()
  })

  it('round-trips board and puzzleId', () => {
    const state = { board: [{ value: 1, given: true, notes: [] }], puzzleId: 'easy-1' }
    saveGame(state, store)
    expect(loadGame(store)).toEqual(state)
  })

  it('returns null when nothing is saved', () => {
    expect(loadGame(store)).toBe(null)
  })

  it('returns null on unparseable data', () => {
    store.setItem(STORAGE_KEY, '{not json')
    expect(loadGame(store)).toBe(null)
  })

  it('returns null on version mismatch', () => {
    store.setItem(STORAGE_KEY, JSON.stringify({ version: STORAGE_VERSION + 1, board: [], puzzleId: 'x' }))
    expect(loadGame(store)).toBe(null)
  })

  it('does not throw when setItem throws', () => {
    const throwing = { getItem: () => null, setItem: () => { throw new Error('full') }, removeItem: () => {} }
    expect(() => saveGame({ board: [], puzzleId: 'x' }, throwing)).not.toThrow()
  })
})
```

- [ ] **Step 2: Run test, verify it fails**

Run: `npm run test -- storage`
Expected: FAIL (module not found).

- [ ] **Step 3: Implement** — create `app/lib/storage.js`:

```js
// Versioned localStorage persistence for the in-progress game.

export const STORAGE_KEY = 'sudoku-cloud:game'
export const STORAGE_VERSION = 1

export function saveGame({ board, puzzleId }, storage = globalThis.localStorage) {
  if (!storage) return
  try {
    storage.setItem(
      STORAGE_KEY,
      JSON.stringify({ version: STORAGE_VERSION, board, puzzleId })
    )
  } catch {
    // storage unavailable or full — ignore
  }
}

export function loadGame(storage = globalThis.localStorage) {
  if (!storage) return null
  const raw = storage.getItem(STORAGE_KEY)
  if (raw == null) return null
  let parsed
  try {
    parsed = JSON.parse(raw)
  } catch {
    return null
  }
  if (!parsed || parsed.version !== STORAGE_VERSION) return null
  return { board: parsed.board, puzzleId: parsed.puzzleId }
}
```

- [ ] **Step 4: Run test, verify it passes**

Run: `npm run test -- storage`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add app/lib/storage.js app/lib/storage.test.js
git commit -m "Add versioned localStorage persistence"
```

---

## Task 7: Full lib suite green

**Files:** none (verification gate).

- [ ] **Step 1: Run the whole suite**

Run: `npm run test`
Expected: PASS — board, grid, validation, reducer, puzzles, storage. No references to the removed `setCell` action remain.

- [ ] **Step 2: Commit (only if you made fixups)**

```bash
git commit -am "Fix up lib tests" # skip if nothing changed
```

---

## Task 8: `Cell` becomes a selectable button

**Files:**
- Rewrite: `app/Cell.js`
- Modify: `app/page.module.css`

- [ ] **Step 1: Rewrite `app/Cell.js`:**

```js
import styles from './page.module.css'

// A single Sudoku cell rendered as a button. Click to select. Shows the value
// when set, otherwise a 3x3 grid of pencil marks. Given cells are read-only.
export default function Cell({ cell, index, conflicted, selected, onSelect }) {
  const className =
    `${styles.cell} ` +
    (cell.given ? styles.given : styles.input) +
    (conflicted ? ` ${styles.wrong}` : '') +
    (selected ? ` ${styles.selected}` : '')

  return (
    <button type="button" className={className} onClick={() => onSelect(index)}>
      {cell.value != null ? (
        cell.value
      ) : cell.notes.length ? (
        <span className={styles.notes}>
          {Array.from({ length: 9 }, (_, k) => k + 1).map((d) => (
            <span key={d} className={styles.noteCell}>
              {cell.notes.includes(d) ? d : ''}
            </span>
          ))}
        </span>
      ) : (
        ''
      )}
    </button>
  )
}
```

- [ ] **Step 2: Update `app/page.module.css`** — make `.cell` work as a button and add new classes:

```css
.cell {
  /* keep existing width/height/border/text-align/font rules; add: */
  background: none;
  padding: 0;
  cursor: pointer;
  position: relative;
}

.selected {
  background: #e8f0fe;
}

.notes {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  grid-template-rows: repeat(3, 1fr);
  width: 100%;
  height: 100%;
}

.noteCell {
  font-size: 9px;
  line-height: 1;
  color: gray;
  display: flex;
  align-items: center;
  justify-content: center;
}
```

(Append `background/padding/cursor/position` to the existing `.cell` rule rather than duplicating it.)

- [ ] **Step 3: Build**

Run: `npm run build`
Expected: SUCCESS (Cell now references `onSelect`/`selected`, which `Board`/`Game` provide after Tasks 9 & 13; build of an unused-prop component still compiles. If the dev server is what you use, it will error until Board passes props — that's fine, continue to Task 9 before manual checks).

- [ ] **Step 4: Commit**

```bash
git add app/Cell.js app/page.module.css
git commit -m "Render cells as selectable buttons with notes"
```

---

## Task 9: `Board` passes selection through

**Files:**
- Modify: `app/Board.js`

- [ ] **Step 1: Rewrite `app/Board.js`:**

```js
import Cell from './Cell'
import styles from './page.module.css'

// Renders the 9x9 grid. `conflicts` is a Set of conflicted cell indices.
export default function Board({ board, conflicts, selectedIndex, onSelect }) {
  return (
    <div className={styles.board}>
      {board.map((cell, i) => (
        <Cell
          key={i}
          cell={cell}
          index={i}
          conflicted={conflicts.has(i)}
          selected={i === selectedIndex}
          onSelect={onSelect}
        />
      ))}
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add app/Board.js
git commit -m "Wire cell selection through Board"
```

---

## Task 10: `Keypad` component

**Files:**
- Create: `app/Keypad.js`
- Modify: `app/page.module.css`

- [ ] **Step 1: Create `app/Keypad.js`:**

```js
import styles from './page.module.css'

// On-screen 1-9 keypad with remaining-count badges, erase, and notes toggle.
// `remaining` is { 1..9: count }. Acts on the selected cell via handlers.
export default function Keypad({ remaining, notesMode, onDigit, onErase, onToggleNotes }) {
  return (
    <div className={styles.keypad}>
      <div className={styles.keys}>
        {Array.from({ length: 9 }, (_, k) => k + 1).map((d) => {
          const left = remaining[d]
          return (
            <button
              key={d}
              type="button"
              className={`${styles.key} ${left === 0 ? styles.keyDisabled : ''}`}
              disabled={left === 0}
              onClick={() => onDigit(d)}
            >
              {d}
              <span className={styles.keyBadge}>{left}</span>
            </button>
          )
        })}
      </div>
      <div className={styles.keyActions}>
        <button type="button" className={styles.key} onClick={onErase}>
          Erase
        </button>
        <button
          type="button"
          className={`${styles.notesToggle} ${notesMode ? styles.notesActive : ''}`}
          onClick={onToggleNotes}
        >
          Notes {notesMode ? 'on' : 'off'}
        </button>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Add styles to `app/page.module.css`:**

```css
.keypad {
  margin-top: 1rem;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.5rem;
}

.keys {
  display: grid;
  grid-template-columns: repeat(9, 1fr);
  gap: 0.25rem;
}

.key {
  position: relative;
  min-width: 34px;
  padding: 0.4rem 0.5rem;
  font-size: 1rem;
  cursor: pointer;
}

.keyBadge {
  position: absolute;
  top: 1px;
  right: 3px;
  font-size: 8px;
  color: gray;
}

.keyDisabled {
  opacity: 0.4;
  cursor: default;
}

.keyActions {
  display: flex;
  gap: 0.5rem;
}

.notesToggle {
  padding: 0.4rem 0.6rem;
  cursor: pointer;
}

.notesActive {
  background: #e8f0fe;
  font-weight: bold;
}
```

- [ ] **Step 3: Commit**

```bash
git add app/Keypad.js app/page.module.css
git commit -m "Add keypad with remaining-count badges and notes toggle"
```

---

## Task 11: `Controls` component

**Files:**
- Create: `app/Controls.js`
- Modify: `app/page.module.css`

- [ ] **Step 1: Create `app/Controls.js`:**

```js
import styles from './page.module.css'

// New game / Reset controls.
export default function Controls({ onNewGame, onReset }) {
  return (
    <div className={styles.controls}>
      <button type="button" className={styles.controlBtn} onClick={onNewGame}>
        New game
      </button>
      <button type="button" className={styles.controlBtn} onClick={onReset}>
        Reset
      </button>
    </div>
  )
}
```

- [ ] **Step 2: Add styles to `app/page.module.css`:**

```css
.controls {
  margin-top: 1rem;
  display: flex;
  gap: 0.5rem;
}

.controlBtn {
  padding: 0.4rem 0.8rem;
  cursor: pointer;
}
```

- [ ] **Step 3: Commit**

```bash
git add app/Controls.js app/page.module.css
git commit -m "Add New game / Reset controls"
```

---

## Task 12: Slim down `StatusBar`

**Files:**
- Modify: `app/StatusBar.js`

- [ ] **Step 1: Rewrite `app/StatusBar.js`:**

```js
import styles from './page.module.css'

// Live game status: conflict count only (per-digit remaining now on the keypad).
export default function StatusBar({ conflictCount }) {
  return (
    <div className={styles.status}>
      <p className={conflictCount > 0 ? styles.wrong : undefined}>
        Conflicts: {conflictCount}
      </p>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add app/StatusBar.js
git commit -m "Slim StatusBar to conflict count only"
```

---

## Task 13: `Game` — state, handlers, keyboard, persistence

**Files:**
- Rewrite: `app/Game.js`

- [ ] **Step 1: Rewrite `app/Game.js`:**

```js
'use client'
import { useReducer, useMemo, useState, useEffect } from 'react'
import Board from './Board'
import StatusBar from './StatusBar'
import Keypad from './Keypad'
import Controls from './Controls'
import { createBoard } from './lib/board'
import { boardReducer } from './lib/reducer'
import { conflicts as findConflicts, remainingByDigit, isWon } from './lib/validation'
import { nextPuzzleId, puzzleById } from './lib/puzzles'
import { loadGame, saveGame } from './lib/storage'
import styles from './page.module.css'

export default function Game({ puzzle }) {
  const [board, dispatch] = useReducer(boardReducer, puzzle.givens, createBoard)
  const [selectedIndex, setSelectedIndex] = useState(null)
  const [notesMode, setNotesMode] = useState(false)
  const [puzzleId, setPuzzleId] = useState(puzzle.id)

  const conflicts = useMemo(() => findConflicts(board), [board])
  const remaining = useMemo(() => remainingByDigit(board), [board])
  const won = useMemo(() => isWon(board), [board])

  // Resume a saved game on mount (client only).
  useEffect(() => {
    const saved = loadGame()
    if (saved && saved.board) {
      dispatch({ type: 'restore', board: saved.board })
      if (saved.puzzleId) setPuzzleId(saved.puzzleId)
    }
  }, [])

  // Persist on every board/puzzle change.
  useEffect(() => {
    saveGame({ board, puzzleId })
  }, [board, puzzleId])

  function handleDigit(d) {
    if (selectedIndex == null) return
    dispatch({ type: notesMode ? 'toggleNote' : 'setValue', index: selectedIndex, value: d })
  }

  function handleErase() {
    if (selectedIndex == null) return
    dispatch({ type: 'clearCell', index: selectedIndex })
  }

  function handleNewGame() {
    const id = nextPuzzleId(puzzleId)
    dispatch({ type: 'newGame', givens: puzzleById(id).givens })
    setPuzzleId(id)
    setSelectedIndex(null)
  }

  function handleReset() {
    dispatch({ type: 'newGame', givens: puzzleById(puzzleId).givens })
    setSelectedIndex(null)
  }

  // Physical keyboard on the selected cell.
  useEffect(() => {
    function onKeyDown(e) {
      if (selectedIndex == null) return
      if (e.key >= '1' && e.key <= '9') {
        dispatch({ type: notesMode ? 'toggleNote' : 'setValue', index: selectedIndex, value: Number(e.key) })
      } else if (e.key === 'Backspace' || e.key === 'Delete') {
        dispatch({ type: 'clearCell', index: selectedIndex })
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [selectedIndex, notesMode])

  return (
    <div className={styles.game}>
      <StatusBar conflictCount={conflicts.size} />
      {won && <p className={styles.win}>Solved! 🎉</p>}
      <Board
        board={board}
        conflicts={conflicts}
        selectedIndex={selectedIndex}
        onSelect={setSelectedIndex}
      />
      <Keypad
        remaining={remaining}
        notesMode={notesMode}
        onDigit={handleDigit}
        onErase={handleErase}
        onToggleNotes={() => setNotesMode((m) => !m)}
      />
      <Controls onNewGame={handleNewGame} onReset={handleReset} />
    </div>
  )
}
```

- [ ] **Step 2: Build**

Run: `npm run build`
Expected: SUCCESS.

- [ ] **Step 3: Commit**

```bash
git add app/Game.js
git commit -m "Wire selection, keypad, controls, keyboard, and persistence in Game"
```

---

## Task 14: `page.js` sources the puzzle from `puzzles.js`

**Files:**
- Modify: `app/page.js`

- [ ] **Step 1: Rewrite `app/page.js`:**

```js
import Game from './Game'
import { PUZZLES } from './lib/puzzles'
import styles from './page.module.css'

export default function Home() {
  return (
    <main className={styles.main}>
      <Game puzzle={PUZZLES[0]} />
    </main>
  )
}
```

- [ ] **Step 2: Build**

Run: `npm run build`
Expected: SUCCESS. No remaining reference to the old `DEFAULT_GIVENS`.

- [ ] **Step 3: Commit**

```bash
git add app/page.js
git commit -m "Source the starting puzzle from the bundled set"
```

---

## Task 15: Manual verification

**Files:** none.

- [ ] **Step 1: Run the app**

Run: `npm run dev` → open http://localhost:3000

- [ ] **Step 2: Verify the checklist**

- [ ] Click a cell → it highlights as selected.
- [ ] Keypad digit and typed `1–9` fill the selected cell; given cells never change.
- [ ] Notes toggle on → digits enter as pencil marks (3×3 inside the cell).
- [ ] Placing a real value clears that cell's notes and removes that digit from peers' notes.
- [ ] Erase button and Backspace/Delete clear the selected cell (value and notes).
- [ ] Keypad badges show remaining counts and dim/disable at 0.
- [ ] Conflicts highlight red; the win message appears on a correct, full board.
- [ ] New game loads a different bundled puzzle; Reset clears entries on the current puzzle.
- [ ] Refresh the page → the in-progress game (values + notes + puzzle) resumes.

- [ ] **Step 3: Run the full test suite once more**

Run: `npm run test`
Expected: PASS.

---

## Task 16: Update the roadmap

**Files:**
- Modify: `README.md`

- [ ] **Step 1:** In `README.md`, mark the four Phase 2 checkboxes as done (`- [x]`) and add the ✅ to the Phase 2 heading, matching the Phase 1 style.

- [ ] **Step 2: Commit**

```bash
git add README.md
git commit -m "Mark Phase 2 complete in README roadmap"
```

---

## Self-Review (completed by plan author)

- **Spec coverage:** keypad (Task 10) with counts moved off StatusBar (Task 12); notes mode + smart cleanup (Tasks 2–3); new game/reset/erase (Tasks 4, 11, 13); bundled puzzles (Task 5); persistence (Task 6, 13); selection model + keyboard (Tasks 8, 9, 13). All spec sections map to tasks.
- **Type consistency:** action names (`setValue`, `toggleNote`, `clearCell`, `newGame`, `restore`), cell shape `{ value, given, notes }`, and helper names (`nextPuzzleId`, `puzzleById`, `saveGame`, `loadGame`, `STORAGE_KEY`, `STORAGE_VERSION`) are used identically across tasks.
- **Sequencing note:** Task 2's two note-dependent `setValue` tests go green only after Task 3 adds `toggleNote`; this is called out explicitly so the executor doesn't treat it as a failure.

## Out of Scope (later phases)

Puzzle generator/solver + "Make sudoku" (Phase 3); styling pass, dark mode, mobile polish, timer, hints, undo/redo, peer/same-number highlighting, arrow-key navigation (Phase 4).
