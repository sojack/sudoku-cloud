# "Make Sudoku" Mode Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let the player enter their own puzzle by hand, validate it has exactly one solution, then play it with normal mistake-checking — completing the Phase 3 "Puzzle variety" roadmap item.

**Architecture:** A new pure `makepuzzle.js` wraps the existing solver to classify entered givens as unique/none/multiple. `Game` gains a `mode: 'play' | 'make'` flag and a `makeMessage`; entering make mode clears the board to an editable grid, Start validates-and-locks, Cancel restores the prior game. `Controls` swaps its buttons by mode. Board/Cell/Keypad are reused unchanged; saving is suppressed while making.

**Tech Stack:** Next.js 16 (App Router) + React 19, CSS Modules, Vitest.

Design spec: `docs/superpowers/specs/2026-05-31-make-sudoku-design.md`

---

## Current State (read before starting)

- `app/lib/solver.js` exports `solve(givens)` (→ solved 81-array or null) and `countSolutions(givens, cap = 2)` (→ 0..cap). Givens use `0` for empty.
- `app/lib/generator.js` exports `DIFFICULTIES` (array of `{ key, label, clues }`) and `generate(difficultyKey)` → `{ givens, solution, difficulty }`.
- `app/lib/storage.js` (v2): `saveGame({ board, solution, difficulty })`, `loadGame()` → `{ board, solution, difficulty } | null`, `clearGame()`.
- `app/lib/board.js` `createBoard(givens)` → 81 cells `{ value, given, notes }`.
- `app/lib/reducer.js` actions: `setValue`, `toggleNote`, `clearCell`, `newGame({givens})`, `restore({board})`.
- `app/Game.js` — current full source reproduced in Task 3. Holds `board`/`givens`/`solution`/`difficulty`/`selectedIndex`/`notesMode`/`ready`. Mount effect: restore a save or `generate('medium')`. Save effect keyed on `[ready, board, solution, difficulty]`. Handlers: `handleDigit`, `handleErase`, `handleNewGame`, `handleReset`, keydown effect. Renders `StatusBar` (mistakeCount), win message, `Board`, `Keypad`, `DifficultySelect`, `Controls`.
- `app/Controls.js` — `{ onNewGame, onReset }`, two buttons using `styles.controls` / `styles.controlBtn`.
- `app/StatusBar.js` — `{ mistakeCount }`, renders "Mistakes: N", red when > 0.
- `app/page.module.css` — has `.controls`, `.controlBtn`, `.difficulty*`, `.status`, `.win`, `.wrong`.
- Commands: `npm run test`, `npm run build`, `npm run dev`. Current suite: 66 tests, 7 files.

## File Structure (created / modified)

- `app/lib/makepuzzle.js` (create) — `validatePuzzle(givens)`.
- `app/lib/makepuzzle.test.js` (create).
- `app/StatusBar.js` (modify) — hide the line when `mistakeCount == null`.
- `app/Controls.js` (modify) — mode-driven buttons.
- `app/Game.js` (modify) — mode/makeMessage state, enter/start/cancel, save guard, restore helper.
- `app/page.module.css` (modify) — message style.

---

## Task 1: `validatePuzzle` helper

**Files:**
- Create: `app/lib/makepuzzle.js`
- Test: `app/lib/makepuzzle.test.js`

- [ ] **Step 1: Write the failing tests** — create `app/lib/makepuzzle.test.js`:

```js
import { describe, it, expect } from 'vitest'
import { validatePuzzle } from './makepuzzle'

// A known uniquely-solvable puzzle (flat, 0 = empty) and its solution.
const UNIQUE = [
  5, 3, 0, 0, 7, 0, 0, 0, 0,
  6, 0, 0, 1, 9, 5, 0, 0, 0,
  0, 9, 8, 0, 0, 0, 0, 6, 0,
  8, 0, 0, 0, 6, 0, 0, 0, 3,
  4, 0, 0, 8, 0, 3, 0, 0, 1,
  7, 0, 0, 0, 2, 0, 0, 0, 6,
  0, 6, 0, 0, 0, 0, 2, 8, 0,
  0, 0, 0, 4, 1, 9, 0, 0, 5,
  0, 0, 0, 0, 8, 0, 0, 7, 9,
]

describe('validatePuzzle', () => {
  it('returns unique with a consistent solution for a unique puzzle', () => {
    const result = validatePuzzle(UNIQUE)
    expect(result.status).toBe('unique')
    expect(result.solution).toHaveLength(81)
    // solution agrees with every given clue
    UNIQUE.forEach((v, i) => {
      if (v !== 0) expect(result.solution[i]).toBe(v)
    })
    // solution is fully filled
    expect(result.solution.every((v) => v >= 1 && v <= 9)).toBe(true)
  })

  it('returns none for a contradictory grid', () => {
    const bad = UNIQUE.slice()
    bad[1] = 5 // two 5s in the top row (index 0 is already 5)
    expect(validatePuzzle(bad)).toEqual({ status: 'none' })
  })

  it('returns multiple for an under-constrained grid', () => {
    // Drop most clues: keep only the first two cells — far from unique.
    const sparse = Array(81).fill(0)
    sparse[0] = 5
    sparse[1] = 3
    expect(validatePuzzle(sparse)).toEqual({ status: 'multiple' })
  })

  it('returns multiple for a fully empty grid', () => {
    expect(validatePuzzle(Array(81).fill(0))).toEqual({ status: 'multiple' })
  })
})
```

- [ ] **Step 2: Run test, verify it fails**

Run: `npm run test -- makepuzzle`
Expected: FAIL (module not found).

- [ ] **Step 3: Implement** — create `app/lib/makepuzzle.js`:

```js
// Classify a hand-entered puzzle by solution count, reusing the solver.
// givens is a flat 81-entry array with 0 for empty.

import { solve, countSolutions } from './solver'

export function validatePuzzle(givens) {
  const n = countSolutions(givens, 2)
  if (n === 0) return { status: 'none' }
  if (n >= 2) return { status: 'multiple' }
  return { status: 'unique', solution: solve(givens) }
}
```

- [ ] **Step 4: Run test, verify it passes**

Run: `npm run test -- makepuzzle`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add app/lib/makepuzzle.js app/lib/makepuzzle.test.js
git commit -m "Add validatePuzzle helper for hand-entered puzzles"
```

---

## Task 2: StatusBar hides the mistake line in make mode

**Files:**
- Modify: `app/StatusBar.js`

- [ ] **Step 1: Rewrite `app/StatusBar.js`** so a `null` count renders nothing (Game passes `null` while making):

```js
import styles from './page.module.css'

// Live game status: count of cells that differ from the solution.
// When mistakeCount is null (e.g. entering a puzzle), the line is hidden.
export default function StatusBar({ mistakeCount }) {
  return (
    <div className={styles.status}>
      {mistakeCount != null && (
        <p className={mistakeCount > 0 ? styles.wrong : undefined}>
          Mistakes: {mistakeCount}
        </p>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add app/StatusBar.js
git commit -m "Hide StatusBar mistake line when count is null"
```

---

## Task 3: Controls swap buttons by mode

**Files:**
- Modify: `app/Controls.js`

- [ ] **Step 1: Rewrite `app/Controls.js`** to take a `mode` and the new handlers:

```js
import styles from './page.module.css'

// Game controls. In play mode: New game / Reset / Make sudoku.
// In make mode: Start / Cancel.
export default function Controls({ mode, onNewGame, onReset, onMakeSudoku, onStart, onCancel }) {
  if (mode === 'make') {
    return (
      <div className={styles.controls}>
        <button type="button" className={styles.controlBtn} onClick={onStart}>
          Start
        </button>
        <button type="button" className={styles.controlBtn} onClick={onCancel}>
          Cancel
        </button>
      </div>
    )
  }
  return (
    <div className={styles.controls}>
      <button type="button" className={styles.controlBtn} onClick={onNewGame}>
        New game
      </button>
      <button type="button" className={styles.controlBtn} onClick={onReset}>
        Reset
      </button>
      <button type="button" className={styles.controlBtn} onClick={onMakeSudoku}>
        Make sudoku
      </button>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add app/Controls.js
git commit -m "Swap Controls buttons between play and make modes"
```

---

## Task 4: Wire make mode into Game

**Files:**
- Modify: `app/Game.js`
- Modify: `app/page.module.css`

- [ ] **Step 1: Rewrite `app/Game.js`.** The current file is reproduced here with the make-mode additions; replace it entirely:

```js
'use client'
import { useReducer, useMemo, useState, useEffect, useCallback } from 'react'
import Board from './Board'
import StatusBar from './StatusBar'
import Keypad from './Keypad'
import Controls from './Controls'
import DifficultySelect from './DifficultySelect'
import { createBoard } from './lib/board'
import { boardReducer } from './lib/reducer'
import { mistakes as findMistakes, remainingByDigit, isSolved } from './lib/validation'
import { generate } from './lib/generator'
import { validatePuzzle } from './lib/makepuzzle'
import { loadGame, saveGame } from './lib/storage'
import styles from './page.module.css'

const EMPTY_GIVENS = Array(81).fill(0)
const DEFAULT_DIFFICULTY = 'medium'
const NO_MISTAKES = new Set()

export default function Game() {
  const [board, dispatch] = useReducer(boardReducer, EMPTY_GIVENS, createBoard)
  const [givens, setGivens] = useState(EMPTY_GIVENS)
  const [solution, setSolution] = useState(EMPTY_GIVENS)
  const [difficulty, setDifficulty] = useState(DEFAULT_DIFFICULTY)
  const [selectedIndex, setSelectedIndex] = useState(null)
  const [notesMode, setNotesMode] = useState(false)
  const [ready, setReady] = useState(false)
  const [mode, setMode] = useState('play')
  const [makeMessage, setMakeMessage] = useState(null)

  const making = mode === 'make'
  const mistakes = useMemo(
    () => (making ? NO_MISTAKES : findMistakes(board, solution)),
    [making, board, solution]
  )
  const remaining = useMemo(() => remainingByDigit(board), [board])
  const won = useMemo(
    () => ready && !making && isSolved(board, solution),
    [ready, making, board, solution]
  )

  // Restore a saved game, or generate a fresh default puzzle. Used on mount
  // and when cancelling make mode.
  const loadOrGenerate = useCallback(() => {
    const saved = loadGame()
    if (saved && saved.board && saved.solution) {
      dispatch({ type: 'restore', board: saved.board })
      setSolution(saved.solution)
      if (saved.difficulty) setDifficulty(saved.difficulty)
      setGivens(saved.board.map((c) => (c.given ? c.value : 0)))
    } else {
      const p = generate(DEFAULT_DIFFICULTY)
      dispatch({ type: 'newGame', givens: p.givens })
      setGivens(p.givens)
      setSolution(p.solution)
      setDifficulty(p.difficulty)
    }
  }, [])

  // On mount: restore or generate.
  useEffect(() => {
    loadOrGenerate()
    setReady(true)
  }, [loadOrGenerate])

  // Persist after the game is ready — but never while making a puzzle.
  useEffect(() => {
    if (!ready || making) return
    saveGame({ board, solution, difficulty })
  }, [ready, making, board, solution, difficulty])

  function handleDigit(d) {
    if (selectedIndex == null) return
    dispatch({ type: notesMode ? 'toggleNote' : 'setValue', index: selectedIndex, value: d })
  }

  function handleErase() {
    if (selectedIndex == null) return
    dispatch({ type: 'clearCell', index: selectedIndex })
  }

  function handleNewGame() {
    const p = generate(difficulty)
    dispatch({ type: 'newGame', givens: p.givens })
    setGivens(p.givens)
    setSolution(p.solution)
    setSelectedIndex(null)
  }

  function handleReset() {
    dispatch({ type: 'newGame', givens })
    setSelectedIndex(null)
  }

  function handleMakeSudoku() {
    dispatch({ type: 'newGame', givens: EMPTY_GIVENS })
    setMode('make')
    setMakeMessage(null)
    setNotesMode(false)
    setSelectedIndex(null)
  }

  function handleStart() {
    const entered = board.map((c) => c.value ?? 0)
    const result = validatePuzzle(entered)
    if (result.status === 'none') {
      setMakeMessage('No solution — check your clues.')
      return
    }
    if (result.status === 'multiple') {
      setMakeMessage('Multiple solutions — add more clues.')
      return
    }
    dispatch({ type: 'newGame', givens: entered })
    setGivens(entered)
    setSolution(result.solution)
    setMode('play')
    setMakeMessage(null)
    setSelectedIndex(null)
  }

  function handleCancel() {
    setMode('play')
    setMakeMessage(null)
    setSelectedIndex(null)
    loadOrGenerate()
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
      <StatusBar mistakeCount={making ? null : mistakes.size} />
      {won && <p className={styles.win}>Solved! 🎉</p>}
      {making && (
        <p className={styles.makeHint}>
          Enter your puzzle, then press Start.
        </p>
      )}
      {makeMessage && <p className={styles.wrong}>{makeMessage}</p>}
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
      {!making && <DifficultySelect value={difficulty} onChange={setDifficulty} />}
      <Controls
        mode={mode}
        onNewGame={handleNewGame}
        onReset={handleReset}
        onMakeSudoku={handleMakeSudoku}
        onStart={handleStart}
        onCancel={handleCancel}
      />
    </div>
  )
}
```

Notes for the implementer:
- `NO_MISTAKES` is a module-level constant empty Set so the `mistakes` memo has a stable empty value in make mode (Board calls `.has(i)` on it — fine).
- In make mode the keypad still shows `remaining` counts; that's harmless (they reflect what's been entered). Notes are disabled by forcing `notesMode` off on entry; the toggle still exists but is not expected to be used while making — leaving it functional is acceptable and out of scope to hide.
- `handleStart` reads `c.value ?? 0` because entered cells hold `value` (number) or `null` (empty).

- [ ] **Step 2: Add styles to `app/page.module.css`** (append at end):

```css
.makeHint {
  margin-top: 0.5rem;
  color: gray;
}
```

- [ ] **Step 3: Build**

Run: `npm run build`
Expected: SUCCESS.

- [ ] **Step 4: Commit**

```bash
git add app/Game.js app/page.module.css
git commit -m "Add make-sudoku mode: enter, validate, start, cancel"
```

---

## Task 5: Full suite + manual verification

**Files:** none.

- [ ] **Step 1: Run the full suite**

Run: `npm run test`
Expected: PASS — including the new `makepuzzle` tests. (67 tests across 8 files.)

- [ ] **Step 2: Run the app**

Run: `npm run dev` → open http://localhost:3000

- [ ] **Step 3: Verify the checklist**

- [ ] *Make sudoku* button appears in play mode; clicking it clears the board, hides the difficulty picker, hides the mistake count, shows the "Enter your puzzle…" hint, and shows Start / Cancel.
- [ ] Typing digits during entry fills cells as plain (non-given) values; Erase/Backspace clears them.
- [ ] Start on a contradictory grid (e.g. two 5s in a row) → "No solution — check your clues." and stays in make mode.
- [ ] Start on a too-sparse grid (a few clues) → "Multiple solutions — add more clues." and stays in make mode.
- [ ] Start on a valid unique puzzle → entered cells lock as givens, play resumes, mistake-checking works (a wrong digit flags red), and the difficulty picker reappears.
- [ ] Cancel during entry returns to the previous game (the one before entering make mode).
- [ ] Refresh after a successful Start resumes the hand-entered puzzle.
- [ ] Refresh during entry (before Start) resumes the prior game, not a blank board.

---

## Task 6: Update the roadmap

**Files:**
- Modify: `README.md`

- [ ] **Step 1:** In `README.md`, mark the make-sudoku item done and the Phase 3 heading complete:

```markdown
### Phase 3 — Puzzle variety ✅

- [x] Puzzle generator + solver with difficulty levels
- [x] "Make sudoku" mode: clear board, enter a puzzle, solve it
```

- [ ] **Step 2: Commit**

```bash
git add README.md
git commit -m "Mark Phase 3 complete in README roadmap"
```

---

## Self-Review (completed by plan author)

- **Spec coverage:** enter-then-Start flow (Task 4 `handleMakeSudoku`/`handleStart`); block+explain with distinct none/multiple messages (Task 1 `validatePuzzle` + Task 4 messaging); Make sudoku button + hidden difficulty picker (Tasks 3, 4); Cancel restores prior game via shared `loadOrGenerate` (Task 4); persist-like-any-game with save suppressed in make mode (Task 4 save guard); mode flag in Game, reducer/components reused (Tasks 2–4). All spec sections map to tasks.
- **Type/name consistency:** `validatePuzzle(givens)` → `{ status: 'unique'|'none'|'multiple', solution? }` defined in Task 1, consumed in Task 4. `Controls` props `{ mode, onNewGame, onReset, onMakeSudoku, onStart, onCancel }` defined in Task 3, passed in Task 4. `StatusBar` `mistakeCount` nullable in Task 2, passed `null` while making in Task 4.
- **Reused-logic check:** `loadOrGenerate` is the single source for restore-or-generate, called by both the mount effect and Cancel (spec's factor-out note). Save effect guards on `!making` so a mid-entry board never overwrites the save.
- **Placeholder scan:** none — every step has complete code/commands.

## Out of Scope

Importing/sharing puzzles by code or URL; Phase 4 polish (timer, hints, undo/redo, peer highlighting, styling, mobile).
