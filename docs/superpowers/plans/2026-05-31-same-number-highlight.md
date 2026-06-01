# Same-Number Highlighting Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** When the selected cell holds a value, highlight every other cell that holds the same digit.

**Architecture:** A pure `sameNumberCells(board, selectedIndex)` helper in a new `app/lib/highlight.js` returns a `Set` of indices (parallel to `mistakes`). `Game` derives it with `useMemo` and threads it through `Board` → `Cell`, which applies a `.sameNumber` CSS class using the already-defined `--peer-bg` variable. No new state, no reducer/persistence changes.

**Tech Stack:** Next.js 16 (App Router) + React 19, CSS Modules, Vitest.

---

## Current State (read before starting)

- `app/lib/validation.js` exports `mistakes(board, solution)` returning a `Set` — the pattern this feature mirrors. Board is 81 cells of `{ value: 1-9 | null, given: boolean, notes: number[] }`.
- `app/Game.js`: client component. Already computes `mistakes` via `useMemo` and passes it to `Board`. Holds `board` (reducer) and `selectedIndex` (`useState`). Renders `<Board board mistakes selectedIndex onSelect />`.
- `app/Board.js`: `Board({ board, mistakes, selectedIndex, onSelect })` maps cells, passing `mistake={mistakes.has(i)}` and `selected={i === selectedIndex}` to each `Cell`.
- `app/Cell.js`: `Cell({ cell, index, mistake, selected, onSelect })`. Builds `className` as:
  `` `${styles.cell} ` + (cell.given ? styles.given : styles.input) + (mistake ? ` ${styles.wrong}` : '') + (selected ? ` ${styles.selected}` : '') ``
- `app/page.module.css`: has `--peer-bg` defined in `globals.css` (light `#f0ece0`, dark `#23272f`). `.selected { background: var(--sel-bg); }` at ~line 102. `.wrong { color: var(--mistake-fg); }`. No `.sameNumber` yet.
- Commands: `npm run test`, `npm run build`, `npm run dev`. Current suite: 74 tests, 9 files.

## File Structure (created / modified)

- `app/lib/highlight.js` (create) — `sameNumberCells(board, selectedIndex)`.
- `app/lib/highlight.test.js` (create) — unit tests.
- `app/Game.js` (modify) — compute + pass `sameNumber`.
- `app/Board.js` (modify) — accept `sameNumber` Set, pass per-cell flag.
- `app/Cell.js` (modify) — accept `sameNumber` prop, apply class.
- `app/page.module.css` (modify) — add `.sameNumber`.

---

## Task 1: `sameNumberCells` helper

**Files:**
- Create: `app/lib/highlight.js`
- Test: `app/lib/highlight.test.js`

- [ ] **Step 1: Write the failing tests** — create `app/lib/highlight.test.js`:

```js
import { describe, it, expect } from 'vitest'
import { sameNumberCells } from './highlight'
import { createBoard } from './board'

function emptyGivens() {
  return Array(81).fill(null)
}

describe('sameNumberCells', () => {
  it('returns an empty set when selectedIndex is null', () => {
    const board = createBoard(emptyGivens())
    expect(sameNumberCells(board, null).size).toBe(0)
  })

  it('returns an empty set when the selected cell is empty', () => {
    const board = createBoard(emptyGivens())
    board[1] = { value: 5, given: false, notes: [] }
    // index 0 is empty and selected → nothing highlights even though a 5 exists
    expect(sameNumberCells(board, 0).size).toBe(0)
  })

  it('highlights other cells with the same value, excluding the selected cell', () => {
    const board = createBoard(emptyGivens())
    board[0] = { value: 5, given: false, notes: [] }
    board[1] = { value: 5, given: true, notes: [] }
    board[40] = { value: 5, given: false, notes: [] }
    board[2] = { value: 3, given: false, notes: [] }
    const result = sameNumberCells(board, 0)
    expect(result.has(0)).toBe(false) // excludes the selected cell
    expect(result.has(1)).toBe(true)
    expect(result.has(40)).toBe(true)
    expect(result.has(2)).toBe(false) // different value
    expect(result.size).toBe(2)
  })

  it('does not match cells that only have the digit in notes', () => {
    const board = createBoard(emptyGivens())
    board[0] = { value: 7, given: false, notes: [] }
    board[5] = { value: null, given: false, notes: [7] } // 7 only as a note
    const result = sameNumberCells(board, 0)
    expect(result.has(5)).toBe(false)
    expect(result.size).toBe(0)
  })

  it('returns an empty set when the value appears only once', () => {
    const board = createBoard(emptyGivens())
    board[0] = { value: 9, given: false, notes: [] }
    expect(sameNumberCells(board, 0).size).toBe(0)
  })
})
```

- [ ] **Step 2: Run test, verify it fails**

Run: `npm run test -- highlight`
Expected: FAIL (module not found).

- [ ] **Step 3: Implement** — create `app/lib/highlight.js`:

```js
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
```

- [ ] **Step 4: Run test, verify it passes**

Run: `npm run test -- highlight`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add app/lib/highlight.js app/lib/highlight.test.js
git commit -m "Add sameNumberCells highlight helper"
```

---

## Task 2: `.sameNumber` style

**Files:**
- Modify: `app/page.module.css`

- [ ] **Step 1: Add the `.sameNumber` rule** to `app/page.module.css`, placed **immediately before** the existing `.selected` rule so selection wins on equal specificity. Find:

```css
.selected {
  background: var(--sel-bg);
}
```

Replace it with:

```css
.sameNumber {
  background: var(--peer-bg);
}

.selected {
  background: var(--sel-bg);
}
```

(`.sameNumber` comes first so that when a cell is both same-number and selected, the later `.selected` rule wins. `.wrong` only sets `color`, so it composes with either background.)

- [ ] **Step 2: Build to confirm CSS compiles**

Run: `npm run build`
Expected: SUCCESS.

- [ ] **Step 3: Commit**

```bash
git add app/page.module.css
git commit -m "Add same-number highlight style using --peer-bg"
```

---

## Task 3: Apply the flag in Cell

**Files:**
- Modify: `app/Cell.js`

- [ ] **Step 1: Rewrite `app/Cell.js`** to accept and apply `sameNumber`. The class order puts `sameNumber` before `selected`/`wrong` so those win:

```js
import styles from './page.module.css'

// A single Sudoku cell rendered as a button. Click to select. Shows the value
// when set, otherwise a 3x3 grid of pencil marks. Given cells are read-only.
export default function Cell({ cell, index, mistake, selected, sameNumber, onSelect }) {
  const className =
    `${styles.cell} ` +
    (cell.given ? styles.given : styles.input) +
    (sameNumber ? ` ${styles.sameNumber}` : '') +
    (mistake ? ` ${styles.wrong}` : '') +
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

- [ ] **Step 2: Build**

Run: `npm run build`
Expected: SUCCESS (the new prop is undefined until Board passes it — harmless; wired in Task 4).

- [ ] **Step 3: Commit**

```bash
git add app/Cell.js
git commit -m "Apply same-number highlight class in Cell"
```

---

## Task 4: Pass the flag through Board

**Files:**
- Modify: `app/Board.js`

- [ ] **Step 1: Rewrite `app/Board.js`** to accept the `sameNumber` Set and pass a per-cell boolean:

```js
import Cell from './Cell'
import styles from './page.module.css'

// Renders the 9x9 grid. `mistakes` and `sameNumber` are Sets of cell indices.
export default function Board({ board, mistakes, sameNumber, selectedIndex, onSelect }) {
  return (
    <div className={styles.board}>
      {board.map((cell, i) => (
        <Cell
          key={i}
          cell={cell}
          index={i}
          mistake={mistakes.has(i)}
          sameNumber={sameNumber.has(i)}
          selected={i === selectedIndex}
          onSelect={onSelect}
        />
      ))}
    </div>
  )
}
```

- [ ] **Step 2: Build**

Run: `npm run build`
Expected: SUCCESS (Game passes `sameNumber` in Task 5; until then `sameNumber` would be undefined and `.has` would throw at runtime — but the build does not execute it. Proceed to Task 5 before manual testing.)

- [ ] **Step 3: Commit**

```bash
git add app/Board.js
git commit -m "Thread sameNumber set through Board"
```

---

## Task 5: Compute and pass `sameNumber` in Game

**Files:**
- Modify: `app/Game.js`

- [ ] **Step 1: Add the import.** In `app/Game.js`, add after the validation import (line 11):

```js
import { sameNumberCells } from './lib/highlight'
```

- [ ] **Step 2: Compute the memo.** After the `mistakes` memo (the block ending at line 36), add:

```js
  const sameNumber = useMemo(
    () => sameNumberCells(board, selectedIndex),
    [board, selectedIndex]
  )
```

- [ ] **Step 3: Pass it to Board.** Change the `<Board … />` element (currently lines 155-160) to include `sameNumber`:

```jsx
      <Board
        board={board}
        mistakes={mistakes}
        sameNumber={sameNumber}
        selectedIndex={selectedIndex}
        onSelect={setSelectedIndex}
      />
```

Leave everything else in `Game.js` unchanged. (Same-number highlighting applies in both play and make modes; in make mode the selected entered value will highlight its duplicates, which is harmless and arguably helpful — no special-casing needed.)

- [ ] **Step 4: Build**

Run: `npm run build`
Expected: SUCCESS.

- [ ] **Step 5: Commit**

```bash
git add app/Game.js
git commit -m "Compute and pass same-number highlight set in Game"
```

---

## Task 6: Full suite + manual verification

**Files:** none.

- [ ] **Step 1: Run the full suite**

Run: `npm run test`
Expected: PASS — including the new `highlight` tests (79 tests across 10 files).

- [ ] **Step 2: Run the app**

Run: `npm run dev` → open http://localhost:3000

- [ ] **Step 3: Verify the checklist**

- [ ] Selecting a filled cell highlights all other cells holding the same digit (given and player-entered alike).
- [ ] The selected cell still shows its own selection style (not the same-number tint).
- [ ] A mistaken cell still reads as a mistake even when it matches the selected digit.
- [ ] Selecting an empty cell adds no extra highlight.
- [ ] The highlight updates as you move the selection and as you place/erase digits.
- [ ] Legible in both light and dark themes (toggle and re-check).

---

## Task 7: Update the roadmap

**Files:**
- Modify: `README.md`

- [ ] **Step 1:** In `README.md` under "Phase 4 — Polish", mark the highlight item done:

```markdown
- [x] Styling pass + dark mode + mobile layout
- [ ] Timer, hint button, undo / redo
- [x] Highlight peers / same-numbers
- [ ] Keyboard navigation between cells
```

(Leave the other two unchecked; do not mark the Phase 4 heading complete.)

- [ ] **Step 2: Commit**

```bash
git add README.md
git commit -m "Mark same-number highlighting complete in README roadmap"
```

---

## Self-Review (completed by plan author)

- **Spec coverage:** pure `sameNumberCells(board, selectedIndex)` returning a Set (Task 1); empty-cell → nothing, notes-not-matched, exclude self, single-occurrence → empty (Task 1 tests); `--peer-bg` styling with selection/mistake precedence (Task 2 ordering + Task 3 className order); data flow Game→Board→Cell mirroring `mistakes` (Tasks 3–5). Every spec section maps to a task.
- **Type/name consistency:** `sameNumberCells` defined in Task 1, imported in Task 5; the prop name `sameNumber` is used identically across Cell (Task 3), Board (Task 4), and Game's `<Board>` (Task 5); the Set→`.has(i)`→boolean flow matches the existing `mistakes` contract.
- **Ordering:** Tasks 2–4 keep the build green; the runtime requires Task 5 (Game passing the Set) before manual play, which is called out in Task 4. Task 1 is independent and fully tested first.
- **Placeholder scan:** none — every step has complete code.

## Out of Scope (later Phase 4 cycles)

Peer (row/column/box) highlighting; matching pencilled notes; arrow-key navigation; timer, hint, undo/redo.
