# Puzzle Generator + Solver Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the fixed bundled puzzle set with a client-side backtracking solver and puzzle generator, letting the player pick Easy/Medium/Hard before each new game; every generated puzzle has exactly one solution.

**Architecture:** Two new pure lib modules — `solver.js` (`solve`, `countSolutions`) and `generator.js` (`generate(difficultyKey)` via fill-then-dig). Persistence stores the solution directly (`{ board, solution, difficulty }`, storage version bumped to 2). `Game` generates on mount / New game and holds `solution`/`difficulty`/`givens` in state; a new `DifficultySelect` component picks the level. The bundled `puzzles.js` table and `puzzleById`/`nextPuzzleId` are removed.

**Tech Stack:** Next.js 16 (App Router) + React 19, CSS Modules, Vitest.

Design spec: `docs/superpowers/specs/2026-05-31-puzzle-generator-design.md`

---

## Current State (read before starting)

- `app/lib/grid.js` exports `rowOf(i)`, `colOf(i)`, `boxOf(i)`, `peersOf(i)` for a flat 81-cell grid.
- `app/lib/board.js` `createBoard(givens)` → 81 cells `{ value, given, notes }` (0/null givens → empty).
- `app/lib/validation.js` exports `mistakes(board, solution)`, `remainingByDigit(board)`, `isSolved(board, solution)`.
- `app/lib/reducer.js` actions: `setValue`, `toggleNote`, `clearCell`, `newGame({givens})`, `restore({board})`.
- `app/lib/puzzles.js` exports `PUZZLES`, `puzzleById`, `nextPuzzleId` — **all removed by this plan.** `app/lib/puzzles.test.js` removed with it.
- `app/lib/storage.js` — v1, persists `{ board, puzzleId }`. Signature: `saveGame({board, puzzleId}, storage=globalThis.localStorage)`, `loadGame(storage=globalThis.localStorage)`. Exports `STORAGE_KEY`, `STORAGE_VERSION`.
- `app/Game.js` — takes `puzzle` prop; holds `board`/`selectedIndex`/`notesMode`/`puzzleId`; derives `solution` from `puzzleById(puzzleId)`; mount effect restores a save; save effect on `[board, puzzleId]`; `handleNewGame` uses `nextPuzzleId`; renders StatusBar/Board/Keypad/Controls. (Full current source is reproduced in Task 6.)
- `app/page.js` — imports `PUZZLES`, renders `<Game puzzle={PUZZLES[0]} />`.
- `app/Controls.js` — `{ onNewGame, onReset }`, two buttons.
- `app/page.module.css` — has `.controls` (flex, gap .5rem, margin-top 1rem) and `.controlBtn` (padding .4rem .8rem, cursor pointer) at the end.
- Commands: `npm run test`, `npm run build`, `npm run dev`. No DOM test env (lib tests are pure JS). Current suite: 59 tests.

## File Structure (created / modified / removed)

- `app/lib/solver.js` (create) — `solve(givens)`, `countSolutions(givens, cap)`.
- `app/lib/solver.test.js` (create).
- `app/lib/generator.js` (create) — `DIFFICULTIES`, `generate(difficultyKey)`.
- `app/lib/generator.test.js` (create).
- `app/lib/storage.js` (modify) — v2, `{ board, solution, difficulty }`.
- `app/lib/storage.test.js` (modify) — new shape + v1-rejection.
- `app/DifficultySelect.js` (create) — level picker.
- `app/Game.js` (rewrite) — generate/restore, hold solution/difficulty/givens.
- `app/page.js` (modify) — render `<Game />`, no bundled import.
- `app/lib/puzzles.js` (delete), `app/lib/puzzles.test.js` (delete).
- `app/page.module.css` (modify) — add difficulty picker styles.

---

## Task 1: Backtracking solver

**Files:**
- Create: `app/lib/solver.js`
- Test: `app/lib/solver.test.js`

- [ ] **Step 1: Write the failing tests** — create `app/lib/solver.test.js`:

```js
import { describe, it, expect } from 'vitest'
import { solve, countSolutions } from './solver'

// A known puzzle (flat, 0 = empty) and its unique solution.
const PUZZLE = [
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
const SOLUTION = [
  5, 3, 4, 6, 7, 8, 9, 1, 2,
  6, 7, 2, 1, 9, 5, 3, 4, 8,
  1, 9, 8, 3, 4, 2, 5, 6, 7,
  8, 5, 9, 7, 6, 1, 4, 2, 3,
  4, 2, 6, 8, 5, 3, 7, 9, 1,
  7, 1, 3, 9, 2, 4, 8, 5, 6,
  9, 6, 1, 5, 3, 7, 2, 8, 4,
  2, 8, 7, 4, 1, 9, 6, 3, 5,
  3, 4, 5, 2, 8, 6, 1, 7, 9,
]

describe('solve', () => {
  it('solves a known puzzle to its unique solution', () => {
    expect(solve(PUZZLE)).toEqual(SOLUTION)
  })

  it('returns null for a contradictory grid', () => {
    const bad = PUZZLE.slice()
    bad[1] = 5 // two 5s in the top row (index 0 is already 5)
    expect(solve(bad)).toBe(null)
  })

  it('treats null entries as empty', () => {
    const withNulls = PUZZLE.map((v) => (v === 0 ? null : v))
    expect(solve(withNulls)).toEqual(SOLUTION)
  })
})

describe('countSolutions', () => {
  it('returns 1 for a uniquely solvable puzzle', () => {
    expect(countSolutions(PUZZLE)).toBe(1)
  })

  it('returns 0 for an unsolvable grid', () => {
    const bad = PUZZLE.slice()
    bad[1] = 5
    expect(countSolutions(bad)).toBe(0)
  })

  it('caps the count at 2 for an under-constrained grid', () => {
    const empty = Array(81).fill(0)
    expect(countSolutions(empty)).toBe(2)
  })

  it('respects a custom cap', () => {
    const empty = Array(81).fill(0)
    expect(countSolutions(empty, 1)).toBe(1)
  })
})
```

- [ ] **Step 2: Run test, verify it fails**

Run: `npm run test -- solver`
Expected: FAIL (module not found).

- [ ] **Step 3: Implement** — create `app/lib/solver.js`:

```js
// Backtracking Sudoku solver over a flat, row-major 81-cell grid (0/null = empty).

function normalize(givens) {
  return givens.map((v) => (v === 0 || v == null ? 0 : v))
}

function canPlace(g, i, v) {
  const r = Math.floor(i / 9)
  const c = i % 9
  const br = Math.floor(r / 3) * 3
  const bc = Math.floor(c / 3) * 3
  for (let k = 0; k < 9; k++) {
    if (g[r * 9 + k] === v) return false
    if (g[k * 9 + c] === v) return false
    if (g[(br + Math.floor(k / 3)) * 9 + (bc + (k % 3))] === v) return false
  }
  return true
}

// Returns a solved copy, or null if there is no solution.
export function solve(givens) {
  const g = normalize(givens)
  function rec(pos) {
    if (pos === 81) return true
    if (g[pos] !== 0) return rec(pos + 1)
    for (let v = 1; v <= 9; v++) {
      if (canPlace(g, pos, v)) {
        g[pos] = v
        if (rec(pos + 1)) return true
        g[pos] = 0
      }
    }
    return false
  }
  return rec(0) ? g : null
}

// Counts distinct solutions, stopping once `cap` is reached.
export function countSolutions(givens, cap = 2) {
  const g = normalize(givens)
  let count = 0
  function rec(pos) {
    if (count >= cap) return
    if (pos === 81) {
      count++
      return
    }
    if (g[pos] !== 0) {
      rec(pos + 1)
      return
    }
    for (let v = 1; v <= 9 && count < cap; v++) {
      if (canPlace(g, pos, v)) {
        g[pos] = v
        rec(pos + 1)
        g[pos] = 0
      }
    }
  }
  rec(0)
  return count
}
```

- [ ] **Step 4: Run test, verify it passes**

Run: `npm run test -- solver`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add app/lib/solver.js app/lib/solver.test.js
git commit -m "Add backtracking Sudoku solver"
```

---

## Task 2: Puzzle generator

**Files:**
- Create: `app/lib/generator.js`
- Test: `app/lib/generator.test.js`

- [ ] **Step 1: Write the failing tests** — create `app/lib/generator.test.js`:

```js
import { describe, it, expect } from 'vitest'
import { generate, DIFFICULTIES } from './generator'
import { countSolutions } from './solver'

function isValidCompleteGrid(grid) {
  if (grid.length !== 81) return false
  for (let i = 0; i < 9; i++) {
    const row = new Set(), col = new Set(), box = new Set()
    for (let k = 0; k < 9; k++) {
      row.add(grid[i * 9 + k])
      col.add(grid[k * 9 + i])
      const br = Math.floor(i / 3) * 3, bc = (i % 3) * 3
      box.add(grid[(br + Math.floor(k / 3)) * 9 + (bc + (k % 3))])
    }
    if (row.size !== 9 || col.size !== 9 || box.size !== 9) return false
  }
  return grid.every((v) => v >= 1 && v <= 9)
}

function clueCount(givens) {
  return givens.filter((v) => v !== 0).length
}

describe('DIFFICULTIES', () => {
  it('has easy, medium, hard with clue targets', () => {
    const keys = DIFFICULTIES.map((d) => d.key)
    expect(keys).toEqual(['easy', 'medium', 'hard'])
    for (const d of DIFFICULTIES) {
      expect(typeof d.label).toBe('string')
      expect(d.clues).toBeGreaterThan(0)
    }
  })
})

describe('generate', () => {
  for (const key of ['easy', 'medium', 'hard']) {
    it(`${key}: produces a uniquely-solvable puzzle of the right shape`, () => {
      const target = DIFFICULTIES.find((d) => d.key === key).clues
      // Run a few times to exercise randomness.
      for (let n = 0; n < 3; n++) {
        const { givens, solution, difficulty } = generate(key)
        expect(difficulty).toBe(key)
        expect(givens).toHaveLength(81)
        expect(clueCount(givens)).toBeGreaterThanOrEqual(target)
        expect(countSolutions(givens)).toBe(1)
        expect(isValidCompleteGrid(solution)).toBe(true)
        givens.forEach((v, i) => {
          if (v !== 0) expect(solution[i]).toBe(v)
        })
      }
    })
  }

  it('defaults to medium for an unknown key', () => {
    const { difficulty } = generate('bogus')
    expect(difficulty).toBe('medium')
  })
})
```

- [ ] **Step 2: Run test, verify it fails**

Run: `npm run test -- generator`
Expected: FAIL (module not found).

- [ ] **Step 3: Implement** — create `app/lib/generator.js`:

```js
// Puzzle generator: build a full grid, then dig clues while uniqueness holds.

import { solve, countSolutions } from './solver'

export const DIFFICULTIES = [
  { key: 'easy', label: 'Easy', clues: 36 },
  { key: 'medium', label: 'Medium', clues: 30 },
  { key: 'hard', label: 'Hard', clues: 26 },
]

const DEFAULT_KEY = 'medium'

function difficultyByKey(key) {
  return DIFFICULTIES.find((d) => d.key === key) ||
    DIFFICULTIES.find((d) => d.key === DEFAULT_KEY)
}

function shuffle(arr) {
  const a = arr.slice()
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

// A complete valid grid via randomized backtracking (solve an empty grid with
// shuffled digit order so the result varies).
function randomFullGrid() {
  const g = Array(81).fill(0)
  function canPlace(i, v) {
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
    for (const v of shuffle([1, 2, 3, 4, 5, 6, 7, 8, 9])) {
      if (canPlace(pos, v)) {
        g[pos] = v
        if (rec(pos + 1)) return true
        g[pos] = 0
      }
    }
    return false
  }
  rec(0)
  return g
}

export function generate(difficultyKey) {
  const level = difficultyByKey(difficultyKey)
  const solution = randomFullGrid()
  const givens = solution.slice()
  let remaining = 81

  for (const i of shuffle([...Array(81).keys()])) {
    if (remaining <= level.clues) break
    const saved = givens[i]
    if (saved === 0) continue
    givens[i] = 0
    if (countSolutions(givens) === 1) {
      remaining--
    } else {
      givens[i] = saved // removal broke uniqueness; restore
    }
  }

  return { givens, solution, difficulty: level.key }
}

// re-exported for any caller that wants to solve a board directly
export { solve }
```

- [ ] **Step 4: Run test, verify it passes**

Run: `npm run test -- generator`
Expected: PASS. (May take a second or two for the hard cases — acceptable.)

- [ ] **Step 5: Commit**

```bash
git add app/lib/generator.js app/lib/generator.test.js
git commit -m "Add fill-then-dig puzzle generator with difficulty bands"
```

---

## Task 3: Persistence v2 (store the solution)

**Files:**
- Modify: `app/lib/storage.js`
- Test: `app/lib/storage.test.js`

- [ ] **Step 1: Rewrite the tests** — replace the contents of `app/lib/storage.test.js`:

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

  it('round-trips board, solution, and difficulty', () => {
    const state = {
      board: [{ value: 1, given: true, notes: [] }],
      solution: [1, 2, 3],
      difficulty: 'medium',
    }
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

  it('returns null on version mismatch (e.g. an old v1 save)', () => {
    store.setItem(STORAGE_KEY, JSON.stringify({ version: 1, board: [], puzzleId: 'easy-1' }))
    expect(loadGame(store)).toBe(null)
  })

  it('uses storage version 2', () => {
    expect(STORAGE_VERSION).toBe(2)
  })

  it('does not throw when setItem throws', () => {
    const throwing = { getItem: () => null, setItem: () => { throw new Error('full') }, removeItem: () => {} }
    expect(() => saveGame({ board: [], solution: [], difficulty: 'easy' }, throwing)).not.toThrow()
  })
})
```

- [ ] **Step 2: Run test, verify it fails**

Run: `npm run test -- storage`
Expected: FAIL (round-trip lacks solution/difficulty; version is 1).

- [ ] **Step 3: Implement** — replace the contents of `app/lib/storage.js`:

```js
// Versioned localStorage persistence for the in-progress game.

export const STORAGE_KEY = 'sudoku-cloud:game'
export const STORAGE_VERSION = 2

export function saveGame({ board, solution, difficulty }, storage = globalThis.localStorage) {
  if (!storage) return
  try {
    storage.setItem(
      STORAGE_KEY,
      JSON.stringify({ version: STORAGE_VERSION, board, solution, difficulty })
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
  return { board: parsed.board, solution: parsed.solution, difficulty: parsed.difficulty }
}
```

- [ ] **Step 4: Run test, verify it passes**

Run: `npm run test -- storage`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add app/lib/storage.js app/lib/storage.test.js
git commit -m "Persist solution and difficulty (storage v2)"
```

---

## Task 4: Remove the bundled puzzle set

**Files:**
- Delete: `app/lib/puzzles.js`, `app/lib/puzzles.test.js`

- [ ] **Step 1: Delete the files**

Run: `git rm app/lib/puzzles.js app/lib/puzzles.test.js`

- [ ] **Step 2: Confirm no lib references remain.** (Game.js and page.js still import them; those are fixed in Tasks 6 and 7. The lib itself must be clean.)

Run: `grep -rn "puzzles" app/lib/`
Expected: no output.

- [ ] **Step 3: Commit**

```bash
git commit -m "Remove bundled puzzle set (replaced by generator)"
```

(Note: the app will not build until Tasks 6–7 land — `Game.js`/`page.js` still import the deleted module. This is an expected intermediate state.)

---

## Task 5: Difficulty picker component

**Files:**
- Create: `app/DifficultySelect.js`
- Modify: `app/page.module.css`

- [ ] **Step 1: Create `app/DifficultySelect.js`:**

```js
import styles from './page.module.css'
import { DIFFICULTIES } from './lib/generator'

// Difficulty picker. `value` is the active difficulty key; `onChange(key)` sets it.
export default function DifficultySelect({ value, onChange }) {
  return (
    <div className={styles.difficulty}>
      {DIFFICULTIES.map((d) => (
        <button
          key={d.key}
          type="button"
          className={`${styles.difficultyBtn} ${value === d.key ? styles.difficultyActive : ''}`}
          onClick={() => onChange(d.key)}
        >
          {d.label}
        </button>
      ))}
    </div>
  )
}
```

- [ ] **Step 2: Add styles to `app/page.module.css`** (append at end):

```css
.difficulty {
  margin-top: 1rem;
  display: flex;
  gap: 0.5rem;
}

.difficultyBtn {
  padding: 0.4rem 0.8rem;
  cursor: pointer;
}

.difficultyActive {
  background: #e8f0fe;
  font-weight: bold;
}
```

- [ ] **Step 3: Commit**

```bash
git add app/DifficultySelect.js app/page.module.css
git commit -m "Add difficulty picker component"
```

---

## Task 6: Wire generation into Game

**Files:**
- Rewrite: `app/Game.js`

- [ ] **Step 1: Rewrite `app/Game.js`** (the current file imports the deleted `puzzles.js` and takes a `puzzle` prop — replace it entirely):

```js
'use client'
import { useReducer, useMemo, useState, useEffect } from 'react'
import Board from './Board'
import StatusBar from './StatusBar'
import Keypad from './Keypad'
import Controls from './Controls'
import DifficultySelect from './DifficultySelect'
import { createBoard } from './lib/board'
import { boardReducer } from './lib/reducer'
import { mistakes as findMistakes, remainingByDigit, isSolved } from './lib/validation'
import { generate } from './lib/generator'
import { loadGame, saveGame } from './lib/storage'
import styles from './page.module.css'

const EMPTY_GIVENS = Array(81).fill(0)
const DEFAULT_DIFFICULTY = 'medium'

export default function Game() {
  // First paint is a deterministic empty board (no generation during SSR).
  const [board, dispatch] = useReducer(boardReducer, EMPTY_GIVENS, createBoard)
  const [givens, setGivens] = useState(EMPTY_GIVENS)
  const [solution, setSolution] = useState(EMPTY_GIVENS)
  const [difficulty, setDifficulty] = useState(DEFAULT_DIFFICULTY)
  const [selectedIndex, setSelectedIndex] = useState(null)
  const [notesMode, setNotesMode] = useState(false)
  const [ready, setReady] = useState(false)

  const mistakes = useMemo(() => findMistakes(board, solution), [board, solution])
  const remaining = useMemo(() => remainingByDigit(board), [board])
  const won = useMemo(() => ready && isSolved(board, solution), [ready, board, solution])

  // On mount: restore a saved game, or generate a fresh default puzzle.
  useEffect(() => {
    const saved = loadGame()
    if (saved && saved.board && saved.solution) {
      dispatch({ type: 'restore', board: saved.board })
      setSolution(saved.solution)
      if (saved.difficulty) setDifficulty(saved.difficulty)
      // Reconstruct givens from the restored board (given cells).
      setGivens(saved.board.map((c) => (c.given ? c.value : 0)))
    } else {
      const p = generate(DEFAULT_DIFFICULTY)
      dispatch({ type: 'newGame', givens: p.givens })
      setGivens(p.givens)
      setSolution(p.solution)
      setDifficulty(p.difficulty)
    }
    setReady(true)
  }, [])

  // Persist after the game is ready (skip the pre-generation empty board).
  useEffect(() => {
    if (!ready) return
    saveGame({ board, solution, difficulty })
  }, [ready, board, solution, difficulty])

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
      <DifficultySelect value={difficulty} onChange={setDifficulty} />
      <Controls onNewGame={handleNewGame} onReset={handleReset} />
    </div>
  )
}
```

Notes for the implementer:
- `won` is gated on `ready` so the all-empty pre-generation board (where `board` values are all `null` and `solution` is all `0`) never reads as solved. `isSolved` compares `cell.value === solution[i]`; `null === 0` is false, so an empty board is not solved even without the gate, but the gate makes the intent explicit and avoids a transient win flash if a save restore lands a solved board.
- Restoring `givens` from the saved board uses the `given` flag (given cells hold the original clue values), which is sufficient for Reset.

- [ ] **Step 2: Commit** (build is verified in Task 7 after `page.js` is fixed)

```bash
git add app/Game.js
git commit -m "Generate or restore puzzles in Game; add difficulty picker"
```

---

## Task 7: Update page.js and verify the build

**Files:**
- Modify: `app/page.js`

- [ ] **Step 1: Rewrite `app/page.js`:**

```js
import Game from './Game'
import styles from './page.module.css'

export default function Home() {
  return (
    <main className={styles.main}>
      <Game />
    </main>
  )
}
```

- [ ] **Step 2: Build**

Run: `npm run build`
Expected: SUCCESS. No remaining references to `puzzles`, `puzzleById`, `nextPuzzleId`, or a `puzzle` prop.

- [ ] **Step 3: Confirm cleanup**

Run: `grep -rn "puzzleById\|nextPuzzleId\|from './lib/puzzles'\|from '../lib/puzzles'" app/`
Expected: no output.

- [ ] **Step 4: Commit**

```bash
git add app/page.js
git commit -m "Render Game without a bundled puzzle"
```

---

## Task 8: Full suite + manual verification

**Files:** none.

- [ ] **Step 1: Run the full suite**

Run: `npm run test`
Expected: PASS — solver, generator, storage, board, reducer, validation, grid. (puzzles tests are gone.)

- [ ] **Step 2: Run the app**

Run: `npm run dev` → open http://localhost:3000

- [ ] **Step 3: Verify the checklist**

- [ ] On first load (clear localStorage first), a Medium puzzle appears after a brief moment.
- [ ] The difficulty picker shows Easy/Medium/Hard with the active one highlighted.
- [ ] Picking a level then New game produces a fresh puzzle; Easy visibly has more clues than Hard.
- [ ] Entering a wrong digit flags red immediately (mistake checking still works against the generated solution).
- [ ] Reset clears your entries but keeps the current puzzle's givens.
- [ ] Solving correctly shows the win message.
- [ ] Refresh resumes the in-progress puzzle (board + solution + difficulty).
- [ ] After this change, manually clear an old v1 save if present (or it is silently discarded) and the app generates fresh.

- [ ] **Step 4: Update the deferred-fix memory note.** The `puzzleById` guard fix is now moot (the lookup is gone). Delete the memory file and its index line:

Run: `rm /Users/jackso/.claude/projects/-Users-jackso-code-sudoku-cloud/memory/phase3-puzzlebyid-guard.md`

Then edit `/Users/jackso/.claude/projects/-Users-jackso-code-sudoku-cloud/memory/MEMORY.md` to remove the `phase3-puzzlebyid-guard` line. (No git commit — memory lives outside the repo.)

---

## Task 9: Update the roadmap

**Files:**
- Modify: `README.md`

- [ ] **Step 1:** In `README.md`, under "Phase 3 — Puzzle variety", mark the generator item done:

```markdown
- [x] Puzzle generator + solver with difficulty levels
- [ ] "Make sudoku" mode: clear board, enter a puzzle, solve it
```

(Leave the "Make sudoku" item unchecked — it is the next cycle. Do not add a ✅ to the Phase 3 heading yet, since the phase is only half done.)

- [ ] **Step 2: Commit**

```bash
git add README.md
git commit -m "Mark generator complete in README roadmap"
```

---

## Self-Review (completed by plan author)

- **Spec coverage:** solver (Task 1), generator + difficulty bands + fill-then-dig (Task 2), persistence v2 storing solution (Task 3), remove bundled set (Task 4), difficulty picker UI (Task 5), generate-on-mount + New game at selected level + Reset from stored givens (Task 6), page render without bundled puzzle + SSR-safe empty first paint (Tasks 6–7), dissolve deferred guard note (Task 8). All spec sections map to tasks.
- **Type/name consistency:** `generate(difficultyKey)` → `{ givens, solution, difficulty }` used identically in Task 2 (def), Task 6 (caller). `DIFFICULTIES` shape `{ key, label, clues }` used in Task 2 (def), Task 5 (picker), Task 2 test. `saveGame({ board, solution, difficulty })` / `loadGame()` → same shape in Task 3 (def) and Task 6 (caller). `solve`/`countSolutions` signatures match across Tasks 1, 2.
- **Ordering:** Task 4 deletes `puzzles.js`, after which the app cannot build until Tasks 6–7 update `Game.js`/`page.js`; this intermediate broken-build state is called out explicitly in Task 4 and the build is verified in Task 7. Lib tests stay green throughout (Tasks 1–3 are additive/independent; the deleted puzzles test goes away with its module in Task 4).
- **Generator contract:** tests assert clue count `>= target`, uniqueness (`countSolutions === 1`), valid complete `solution`, and givens/solution consistency — matching the spec's contract. Randomness is exercised by repetition; assertions are on invariants, not specific grids.

## Out of Scope (next cycle / later)

"Make sudoku" mode (enter your own givens, validate uniqueness, play) — next Phase 3 cycle, reuses `solver.js`. Technique-based difficulty grading, timer, hints, undo/redo, styling (Phase 4).
