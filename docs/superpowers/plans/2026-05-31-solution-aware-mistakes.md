# Solution-Aware Mistake Checking Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Flag a cell red the instant its value differs from the puzzle's unique solution, replacing rule-based conflict checking, so the player can never reach an unrecoverable dead end.

**Architecture:** Store a precomputed `solution` (81 digits) on each bundled puzzle. Replace `conflicts`/`conflictCount`/`isWon` in the validation lib with `mistakes(board, solution)` and `isSolved(board, solution)`. Thread `solution` through `Game` and rename the per-cell `conflicted` prop to `mistake`; the StatusBar shows "Mistakes: N". The solution is looked up by `puzzleId` (never persisted).

**Tech Stack:** Next.js 16 (App Router) + React 19, CSS Modules, Vitest.

Design spec: `docs/superpowers/specs/2026-05-31-solution-aware-mistakes-design.md`

---

## Current State (read before starting)

- `app/lib/validation.js` exports `conflicts(board)`, `conflictCount(board)`, `remainingByDigit(board)`, `isComplete(board)`, `isWon(board)`. `conflicts` uses `peersOf` from `grid.js`.
- `app/lib/validation.test.js` tests all five.
- `app/lib/puzzles.js` exports `PUZZLES` (6 entries: `{ id, difficulty, givens }`), `puzzleById(id)`, `nextPuzzleId(currentId)`. Each `givens` is a flat 81-entry array (0 = empty). All puzzles are uniquely solvable.
- `app/lib/puzzles.test.js` imports `conflicts` from `./validation` for its "no puzzle has initial conflicts" test — **this import must be removed** in Task 1 since `conflicts` is being deleted.
- `app/Game.js` imports `conflicts as findConflicts`, `remainingByDigit`, `isWon`; computes `conflicts`/`remaining`/`won` via `useMemo`; passes `conflictCount={conflicts.size}` to StatusBar and `conflicts={conflicts}` to Board. `Game` takes a `puzzle` prop (`{ id, givens }`) and uses `puzzleById(id).givens` for New game / Reset.
- `app/Board.js` takes `{ board, conflicts, selectedIndex, onSelect }`; passes `conflicted={conflicts.has(i)}` to Cell.
- `app/Cell.js` takes `{ cell, index, conflicted, selected, onSelect }`; applies `styles.wrong` when `conflicted`.
- `app/StatusBar.js` takes `{ conflictCount }`; renders "Conflicts: N" with `.wrong` when > 0.
- Commands: `npm run test`, `npm run build`, `npm run dev`. No DOM test env (lib tests are pure JS).

## File Structure (created / modified)

- `app/lib/puzzles.js` (modify) — add `solution` to each puzzle.
- `app/lib/puzzles.test.js` (modify) — drop the `conflicts` import; add solution validity + consistency tests; keep the existing givens well-formedness test but make it self-contained.
- `app/lib/validation.js` (modify) — add `mistakes`, `isSolved`; remove `conflicts`, `conflictCount`, `isWon`, `isComplete`.
- `app/lib/validation.test.js` (rewrite) — tests for `mistakes`, `isSolved`, `remainingByDigit`.
- `app/Cell.js` (modify) — rename `conflicted` → `mistake`.
- `app/Board.js` (modify) — rename `conflicts` → `mistakes`.
- `app/StatusBar.js` (modify) — `mistakeCount`, "Mistakes: N".
- `app/Game.js` (modify) — thread `solution`; derive `mistakes`/`won`.

---

## Task 1: Add `solution` to each bundled puzzle

**Files:**
- Modify: `app/lib/puzzles.js`
- Test: `app/lib/puzzles.test.js`

- [ ] **Step 1: Compute the six solutions.** Each puzzle is uniquely solvable, so each has exactly one completed grid. Compute them with a one-off backtracking solver (do NOT ship the solver — it is a throwaway tool to generate the static data). Create a temp script `/tmp/solve.mjs`:

```js
import { PUZZLES } from '/Users/jackso/code/sudoku-cloud/app/lib/puzzles.js'

function solve(grid) {
  const g = grid.map((x) => x ?? 0)
  function ok(i, v) {
    const r = Math.floor(i / 9), c = i % 9
    const br = Math.floor(r / 3) * 3, bc = Math.floor(c / 3) * 3
    for (let k = 0; k < 9; k++) {
      if (g[r * 9 + k] === v) return false
      if (g[k * 9 + c] === v) return false
      if (g[(br + Math.floor(k / 3)) * 9 + (bc + (k % 3))] === v) return false
    }
    return true
  }
  function rec(pos) {
    if (pos === 81) return true
    if (g[pos] !== 0) return rec(pos + 1)
    for (let v = 1; v <= 9; v++) {
      if (ok(pos, v)) { g[pos] = v; if (rec(pos + 1)) return true; g[pos] = 0 }
    }
    return false
  }
  rec(0)
  return g
}

for (const p of PUZZLES) {
  console.log(p.id, JSON.stringify(solve(p.givens)))
}
```

Run: `node /tmp/solve.mjs`
Expected: one line per puzzle id with its 81-digit solution array. Keep this output to paste in Step 3.

- [ ] **Step 2: Write the failing tests** — replace the contents of `app/lib/puzzles.test.js` with (note: no `conflicts` import — the solution check is self-contained):

```js
import { describe, it, expect } from 'vitest'
import { PUZZLES, nextPuzzleId, puzzleById } from './puzzles'

// A complete grid is valid when every row, column, and 3x3 box is a
// permutation of 1-9.
function isValidCompleteGrid(grid) {
  if (grid.length !== 81) return false
  const groups = []
  for (let i = 0; i < 9; i++) {
    const row = [], col = [], box = []
    for (let k = 0; k < 9; k++) {
      row.push(grid[i * 9 + k])
      col.push(grid[k * 9 + i])
      const br = Math.floor(i / 3) * 3, bc = (i % 3) * 3
      box.push(grid[(br + Math.floor(k / 3)) * 9 + (bc + (k % 3))])
    }
    groups.push(row, col, box)
  }
  return groups.every((g) => new Set(g).size === 9 && g.every((v) => v >= 1 && v <= 9))
}

describe('PUZZLES', () => {
  it('has at least 6 puzzles', () => {
    expect(PUZZLES.length).toBeGreaterThanOrEqual(6)
  })

  it('each puzzle has well-formed givens', () => {
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

  it('each puzzle has a valid complete solution', () => {
    for (const p of PUZZLES) {
      expect(p.solution).toHaveLength(81)
      expect(isValidCompleteGrid(p.solution)).toBe(true)
    }
  })

  it('each solution is consistent with its givens', () => {
    for (const p of PUZZLES) {
      p.givens.forEach((g, i) => {
        if (g !== 0 && g != null) expect(p.solution[i]).toBe(g)
      })
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

- [ ] **Step 3: Run test, verify it fails**

Run: `npm run test -- puzzles`
Expected: FAIL — the "valid complete solution" and "consistent with givens" tests fail because `solution` is undefined.

- [ ] **Step 4: Implement** — in `app/lib/puzzles.js`, add a `solution: [...]` field to each puzzle object, using the arrays printed in Step 1 (match each by id). Keep `givens` unchanged. Update the file's header comment to note that each puzzle also carries its precomputed unique `solution`.

- [ ] **Step 5: Run test, verify it passes**

Run: `npm run test -- puzzles`
Expected: PASS (all puzzle tests).

- [ ] **Step 6: Clean up the temp solver**

Run: `rm /tmp/solve.mjs`

- [ ] **Step 7: Commit**

```bash
git add app/lib/puzzles.js app/lib/puzzles.test.js
git commit -m "Store precomputed solution on each bundled puzzle"
```

---

## Task 2: Replace conflict checks with mistake checks in validation

**Files:**
- Modify: `app/lib/validation.js`
- Test: `app/lib/validation.test.js`

- [ ] **Step 1: Rewrite the tests** — replace the contents of `app/lib/validation.test.js` with:

```js
import { describe, it, expect } from 'vitest'
import { mistakes, isSolved, remainingByDigit } from './validation'
import { createBoard } from './board'

function emptyGivens() {
  return Array(81).fill(null)
}

// A simple known solution: each row is 1..9 rotated, which is a valid grid.
// (Used only as a reference array for mistake/solved tests.)
function refSolution() {
  const g = []
  for (let r = 0; r < 9; r++) {
    const shift = (r % 3) * 3 + Math.floor(r / 3)
    for (let c = 0; c < 9; c++) g.push(((c + shift) % 9) + 1)
  }
  return g
}

describe('mistakes', () => {
  it('flags a cell whose value differs from the solution', () => {
    const solution = refSolution()
    const board = createBoard(emptyGivens())
    board[0] = { value: solution[0] === 1 ? 2 : 1, given: false, notes: [] }
    expect(mistakes(board, solution).has(0)).toBe(true)
  })

  it('does not flag a cell whose value matches the solution', () => {
    const solution = refSolution()
    const board = createBoard(emptyGivens())
    board[0] = { value: solution[0], given: false, notes: [] }
    expect(mistakes(board, solution).has(0)).toBe(false)
  })

  it('does not flag empty cells', () => {
    const solution = refSolution()
    const board = createBoard(emptyGivens())
    expect(mistakes(board, solution).size).toBe(0)
  })

  it('does not flag given cells (they match the solution)', () => {
    const solution = refSolution()
    const givens = emptyGivens()
    givens[0] = solution[0]
    const board = createBoard(givens)
    expect(mistakes(board, solution).has(0)).toBe(false)
  })
})

describe('isSolved', () => {
  it('is false on an empty board', () => {
    const solution = refSolution()
    const board = createBoard(emptyGivens())
    expect(isSolved(board, solution)).toBe(false)
  })

  it('is false when one cell is wrong', () => {
    const solution = refSolution()
    const board = solution.map((v, i) => ({
      value: i === 0 ? (v === 1 ? 2 : 1) : v,
      given: false,
      notes: [],
    }))
    expect(isSolved(board, solution)).toBe(false)
  })

  it('is true when every cell matches the solution', () => {
    const solution = refSolution()
    const board = solution.map((v) => ({ value: v, given: false, notes: [] }))
    expect(isSolved(board, solution)).toBe(true)
  })
})

describe('remainingByDigit', () => {
  it('starts at 9 for every digit on an empty board', () => {
    const board = createBoard(emptyGivens())
    const r = remainingByDigit(board)
    for (let d = 1; d <= 9; d++) expect(r[d]).toBe(9)
  })

  it('counts placed values', () => {
    const board = createBoard(emptyGivens())
    board[0] = { value: 5, given: false, notes: [] }
    board[1] = { value: 5, given: false, notes: [] }
    const r = remainingByDigit(board)
    expect(r[5]).toBe(7)
  })
})
```

- [ ] **Step 2: Run test, verify it fails**

Run: `npm run test -- validation`
Expected: FAIL — `mistakes` and `isSolved` are not exported.

- [ ] **Step 3: Implement** — replace the contents of `app/lib/validation.js` with:

```js
// Solution-aware validation and game-status derivations.
// A board is 81 cells of { value: 1-9 | null, given: boolean, notes: number[] }.
// A solution is 81 digits 1-9 (the puzzle's unique completed grid).

// Indices of filled cells whose value differs from the solution.
// Empty cells are never mistakes; given cells match the solution by construction.
export function mistakes(board, solution) {
  const flagged = new Set()
  for (let i = 0; i < 81; i++) {
    const value = board[i].value
    if (value == null) continue
    if (value !== solution[i]) flagged.add(i)
  }
  return flagged
}

// For each digit 1-9, how many are still to be placed (clamped at 0).
export function remainingByDigit(board) {
  const remaining = {}
  for (let d = 1; d <= 9; d++) remaining[d] = 9

  for (const cell of board) {
    if (cell.value != null) {
      remaining[cell.value] = Math.max(0, remaining[cell.value] - 1)
    }
  }

  return remaining
}

// True when every cell's value equals the solution.
export function isSolved(board, solution) {
  return board.every((cell, i) => cell.value === solution[i])
}
```

(This deletes `conflicts`, `conflictCount`, `isComplete`, `isWon`, and the `peersOf` import.)

- [ ] **Step 4: Run test, verify it passes**

Run: `npm run test -- validation`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add app/lib/validation.js app/lib/validation.test.js
git commit -m "Replace conflict checks with solution-aware mistakes"
```

---

## Task 3: Rename `conflicted` → `mistake` in Cell

**Files:**
- Modify: `app/Cell.js`

- [ ] **Step 1: Edit `app/Cell.js`** — rename the prop and the class condition. Change the signature from `{ cell, index, conflicted, selected, onSelect }` to `{ cell, index, mistake, selected, onSelect }`, and change the className line that referenced `conflicted` to use `mistake`:

```js
export default function Cell({ cell, index, mistake, selected, onSelect }) {
  const className =
    `${styles.cell} ` +
    (cell.given ? styles.given : styles.input) +
    (mistake ? ` ${styles.wrong}` : '') +
    (selected ? ` ${styles.selected}` : '')
  // ...rest unchanged
```

- [ ] **Step 2: Commit**

```bash
git add app/Cell.js
git commit -m "Rename Cell conflicted prop to mistake"
```

---

## Task 4: Rename `conflicts` → `mistakes` in Board

**Files:**
- Modify: `app/Board.js`

- [ ] **Step 1: Rewrite `app/Board.js`:**

```js
import Cell from './Cell'
import styles from './page.module.css'

// Renders the 9x9 grid. `mistakes` is a Set of cell indices that differ from
// the solution.
export default function Board({ board, mistakes, selectedIndex, onSelect }) {
  return (
    <div className={styles.board}>
      {board.map((cell, i) => (
        <Cell
          key={i}
          cell={cell}
          index={i}
          mistake={mistakes.has(i)}
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
git commit -m "Rename Board conflicts prop to mistakes"
```

---

## Task 5: StatusBar shows "Mistakes: N"

**Files:**
- Modify: `app/StatusBar.js`

- [ ] **Step 1: Rewrite `app/StatusBar.js`:**

```js
import styles from './page.module.css'

// Live game status: count of cells that differ from the solution.
export default function StatusBar({ mistakeCount }) {
  return (
    <div className={styles.status}>
      <p className={mistakeCount > 0 ? styles.wrong : undefined}>
        Mistakes: {mistakeCount}
      </p>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add app/StatusBar.js
git commit -m "Show mistake count in StatusBar"
```

---

## Task 6: Thread the solution through Game

**Files:**
- Modify: `app/Game.js`

- [ ] **Step 1: Edit `app/Game.js`.** Update the validation import, derive `mistakes`/`won` from the solution, hold the current solution, and pass the renamed props. The full file should read:

```js
'use client'
import { useReducer, useMemo, useState, useEffect } from 'react'
import Board from './Board'
import StatusBar from './StatusBar'
import Keypad from './Keypad'
import Controls from './Controls'
import { createBoard } from './lib/board'
import { boardReducer } from './lib/reducer'
import { mistakes as findMistakes, remainingByDigit, isSolved } from './lib/validation'
import { nextPuzzleId, puzzleById } from './lib/puzzles'
import { loadGame, saveGame } from './lib/storage'
import styles from './page.module.css'

export default function Game({ puzzle }) {
  const [board, dispatch] = useReducer(boardReducer, puzzle.givens, createBoard)
  const [selectedIndex, setSelectedIndex] = useState(null)
  const [notesMode, setNotesMode] = useState(false)
  const [puzzleId, setPuzzleId] = useState(puzzle.id)

  const solution = useMemo(() => puzzleById(puzzleId).solution, [puzzleId])
  const mistakes = useMemo(() => findMistakes(board, solution), [board, solution])
  const remaining = useMemo(() => remainingByDigit(board), [board])
  const won = useMemo(() => isSolved(board, solution), [board, solution])

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
      <StatusBar mistakeCount={mistakes.size} />
      {won && <p className={styles.win}>Solved! 🎉</p>}
      <Board
        board={board}
        mistakes={mistakes}
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

- [ ] **Step 3: Confirm no stale references remain**

Run: `grep -rn "conflict\|isWon\|isComplete" app/ --include=*.js | grep -v test`
Expected: no output (all production references gone; the word "conflict" should not appear in app JS).

- [ ] **Step 4: Commit**

```bash
git add app/Game.js
git commit -m "Derive mistakes and win state from the puzzle solution"
```

---

## Task 7: Full suite + manual verification

**Files:** none.

- [ ] **Step 1: Run the full suite**

Run: `npm run test`
Expected: PASS (puzzles, validation, board, reducer, storage, grid — all green).

- [ ] **Step 2: Run the app**

Run: `npm run dev` → open http://localhost:3000

- [ ] **Step 3: Verify the checklist**

- [ ] Entering a digit that is wrong for the solution turns that cell red immediately.
- [ ] Correcting it (overwriting with the right digit, or erasing) clears the red.
- [ ] A correct digit is never flagged; given cells are never flagged.
- [ ] The status reads "Mistakes: N" and is red only when N > 0.
- [ ] Filling the board entirely with the correct solution shows the win message.
- [ ] No two-different-reds or leftover "Conflicts" text anywhere.

---

## Self-Review (completed by plan author)

- **Spec coverage:** flag-immediately (Tasks 3–6, using existing `.wrong`), replace conflicts with mistakes (Task 2 removes `conflicts`/`conflictCount`/`isWon`; adds `mistakes`/`isSolved`), "Mistakes: N" counter (Task 5), stored per-puzzle solution not persisted (Task 1; `Game` looks it up by `puzzleId` in Task 6), win = full correct board (Task 2 `isSolved`, wired in Task 6). All spec sections map to tasks.
- **Cross-file consistency:** the `conflicts` import in `puzzles.test.js` is removed in Task 1 (self-contained `isValidCompleteGrid` replaces it), so deleting `conflicts` in Task 2 leaves no dangling import. Prop names align: `Cell` `mistake` (Task 3) ↔ `Board` passes `mistake=` (Task 4); `Board` `mistakes` (Task 4) ↔ `Game` passes `mistakes=` (Task 6); `StatusBar` `mistakeCount` (Task 5) ↔ `Game` passes `mistakeCount=` (Task 6).
- **Ordering:** Task 1 and Task 2 both touch the puzzles/validation test boundary; Task 1 must land first so `puzzles.test.js` no longer imports `conflicts` before Task 2 deletes it. Tasks 3–5 are independent leaf renames; the app does not build until Task 6 updates `Game` (expected intermediate state).

## Out of Scope

Runtime solver + generator (Phase 3); hints, undo/redo, peer highlighting, blocking wrong entries outright (Phase 4 / rejected in favour of immediate flagging).
