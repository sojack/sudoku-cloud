# Mistake Budget Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give the player a budget of three mistakes per puzzle — a wrong placement costs a strike, the third strike freezes the board with a game-over modal — closing the "spam a cell until the right number sticks" exploit.

**Architecture:** A pure, unit-tested helper (`isStrike`) decides whether a placement is a new wrong value. `Game.js` keeps a `mistakeCount`, increments it on the two value-placement paths, derives `gameOver`, and gates all input when the budget is spent. The count persists in the savegame (additive field, no version bump) so reloads can't reset strikes. Two small presentational components render the counter and the game-over modal.

**Tech Stack:** Next.js 16 (App Router) + React 19, CSS Modules, Vitest. Logic libs are pure (no React); tests are colocated `*.test.js` using `import { describe, it, expect } from 'vitest'`.

**Conventions:**
- Board cells are `{ value: 1-9 | null, given: boolean, notes: number[] }`. A solution is 81 digits 1-9.
- Commit messages are plain descriptive sentences (no `feat:`/`fix:` prefixes), ending with the trailer:
  ```
  Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
  ```
- `npm run lint` is **known-broken** under Next 16 (it treats "lint" as a directory). Do **not** treat lint failures as blocking. Verify with `npx vitest run` and `npm run build`.
- Run the full suite with `npx vitest run`; a single file with `npx vitest run <path>`.

---

### Task 1: `isStrike` pure helper

**Files:**
- Modify: `app/lib/validation.js`
- Test: `app/lib/validation.test.js`

- [ ] **Step 1: Write the failing test**

Append to `app/lib/validation.test.js` (after the final `describe` block, before the end of file):

```js
describe('isStrike', () => {
  it('is a strike when a new wrong value is placed in an empty cell', () => {
    // sol=3, placing 5 over an empty cell
    expect(isStrike(null, 5, 3)).toBe(true)
  })
  it('is not a strike when the correct value is placed', () => {
    expect(isStrike(null, 3, 3)).toBe(false)
  })
  it('is not a strike when re-placing the same wrong value (no change)', () => {
    expect(isStrike(5, 5, 3)).toBe(false)
  })
  it('is a strike when changing one wrong value to another wrong value', () => {
    expect(isStrike(5, 7, 3)).toBe(true)
  })
  it('is not a strike when replacing a wrong value with the correct one', () => {
    expect(isStrike(5, 3, 3)).toBe(false)
  })
})
```

Also add `isStrike` to the existing import at the top of `app/lib/validation.test.js`:

```js
import { mistakes, isSolved, remainingByDigit, lockedCells, hasEntries, isStrike } from './validation'
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run app/lib/validation.test.js`
Expected: FAIL — `isStrike is not a function` / not exported.

- [ ] **Step 3: Write the minimal implementation**

Append to `app/lib/validation.js` (after `lockedCells`, at the end of the file):

```js
// True when placing `nextValue` in a cell is a *new wrong* value: an actual
// change away from the previous value, to something other than the solution
// digit. Re-placing the same wrong value, erasing, and correct placements never
// strike. This is the whole anti-spam rule — abusing instant feedback by cycling
// digits now costs one strike per distinct wrong guess.
export function isStrike(prevValue, nextValue, solutionDigit) {
  return nextValue !== prevValue && nextValue !== solutionDigit
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run app/lib/validation.test.js`
Expected: PASS — all five `isStrike` cases green, existing tests still green.

- [ ] **Step 5: Commit**

```bash
git add app/lib/validation.js app/lib/validation.test.js
git commit -m "$(cat <<'EOF'
Add isStrike helper for the mistake budget

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
EOF
)"
```

---

### Task 2: Persist `mistakeCount` in the savegame

**Files:**
- Modify: `app/lib/storage.js`
- Test: `app/lib/storage.test.js`

The field is additive with a `?? 0` default, so `STORAGE_VERSION` stays **3** — existing in-progress games (including synced ones) are preserved.

- [ ] **Step 1: Write the failing test**

Append to `app/lib/storage.test.js` inside the `describe('savegame persistence', ...)` block (before its closing `})`):

```js
  it('round-trips mistakeCount', () => {
    saveGame({
      board: [],
      solution: [],
      difficulty: 'easy',
      category: 'easy',
      recorded: false,
      mistakeCount: 2,
    })
    expect(loadGame().mistakeCount).toBe(2)
  })
  it('defaults mistakeCount to 0 for a legacy save written without it', () => {
    localStorage.setItem(
      'sudoku-cloud:savegame',
      JSON.stringify({ version: STORAGE_VERSION, board: [], solution: [], difficulty: 'easy' })
    )
    expect(loadGame().mistakeCount).toBe(0)
  })
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run app/lib/storage.test.js`
Expected: FAIL — `loadGame().mistakeCount` is `undefined`.

- [ ] **Step 3: Write the implementation**

In `app/lib/storage.js`, change the `saveGame` signature and payload. Replace:

```js
export function saveGame({ board, solution, difficulty, category, recorded, savedAt }) {
  if (typeof localStorage === 'undefined') return;
  const payload = JSON.stringify({
    version: STORAGE_VERSION,
    board,
    solution,
    difficulty,
    category,
    recorded,
    // savedAt reflects the last *edit*, supplied by the caller, so it survives a
    // restore-from-storage. Falls back to now only when not provided.
    savedAt: savedAt ?? Date.now(),
  });
  localStorage.setItem(KEY, payload);
}
```

with:

```js
export function saveGame({ board, solution, difficulty, category, recorded, savedAt, mistakeCount }) {
  if (typeof localStorage === 'undefined') return;
  const payload = JSON.stringify({
    version: STORAGE_VERSION,
    board,
    solution,
    difficulty,
    category,
    recorded,
    mistakeCount: mistakeCount ?? 0,
    // savedAt reflects the last *edit*, supplied by the caller, so it survives a
    // restore-from-storage. Falls back to now only when not provided.
    savedAt: savedAt ?? Date.now(),
  });
  localStorage.setItem(KEY, payload);
}
```

Then in `loadGame`, add `mistakeCount` to the returned object. Replace:

```js
    return {
      board: data.board,
      solution: data.solution,
      difficulty: data.difficulty,
      category: data.category ?? data.difficulty ?? null,
      recorded: data.recorded ?? false,
      savedAt: data.savedAt ?? 0,
    };
```

with:

```js
    return {
      board: data.board,
      solution: data.solution,
      difficulty: data.difficulty,
      category: data.category ?? data.difficulty ?? null,
      recorded: data.recorded ?? false,
      savedAt: data.savedAt ?? 0,
      mistakeCount: data.mistakeCount ?? 0,
    };
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run app/lib/storage.test.js`
Expected: PASS — the two new cases green, the existing `is at version 3` assertion still green.

- [ ] **Step 5: Commit**

```bash
git add app/lib/storage.js app/lib/storage.test.js
git commit -m "$(cat <<'EOF'
Persist mistakeCount in the savegame

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
EOF
)"
```

---

### Task 3: Mistake counter component

**Files:**
- Create: `app/MistakeCounter.js`
- Modify: `app/page.module.css`

No component-test framework exists; verified by `npm run build` and manual play. Follow the existing presentational-component pattern (e.g. `Toast.js`).

- [ ] **Step 1: Add the counter styles**

Append to `app/page.module.css`:

```css
.mistakeCounter {
  margin-top: 0.5rem;
  color: var(--muted);
  font-weight: bold;
  font-variant-numeric: tabular-nums;
}

.mistakeCounterMax {
  color: var(--mistake-fg);
}
```

- [ ] **Step 2: Create the component**

Create `app/MistakeCounter.js`:

```js
'use client'
import styles from './page.module.css'

// Shows how many mistakes the player has made out of the allowed budget. Turns
// to the alert colour once the budget is exhausted. Pure presentational — reads
// only its props.
export default function MistakeCounter({ count, max }) {
  const className = `${styles.mistakeCounter} ${count >= max ? styles.mistakeCounterMax : ''}`
  return (
    <p className={className}>
      Mistakes {count} / {max}
    </p>
  )
}
```

- [ ] **Step 3: Verify the build compiles**

Run: `npm run build`
Expected: build succeeds (the component is not yet rendered anywhere, but it must compile).

- [ ] **Step 4: Commit**

```bash
git add app/MistakeCounter.js app/page.module.css
git commit -m "$(cat <<'EOF'
Add mistake counter component

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
EOF
)"
```

---

### Task 4: Game-over modal component

**Files:**
- Create: `app/GameOverDialog.js`

Reuses `app/ConfirmDialog.module.css` (already present) for styling, mirroring `ConfirmDialog.js`. Verified by `npm run build` and manual play.

- [ ] **Step 1: Create the component**

Create `app/GameOverDialog.js`:

```js
'use client'
import { useEffect } from 'react'
import styles from './ConfirmDialog.module.css'

// Shown when the mistake budget is exhausted. The board is already frozen by the
// caller; this announces game over and offers the two ways forward. Backdrop
// click or Escape dismisses the dialog (so the player can inspect the final
// board) without unfreezing — the Controls bar remains the path forward.
export default function GameOverDialog({ onNewGame, onReset, onDismiss }) {
  useEffect(() => {
    function onKey(e) {
      if (e.key === 'Escape') onDismiss()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onDismiss])

  return (
    <div className={styles.backdrop} onClick={onDismiss}>
      <div
        className={styles.dialog}
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
      >
        <p className={styles.message}>Out of mistakes — game over.</p>
        <div className={styles.actions}>
          <button type="button" className={styles.cancel} onClick={onReset}>
            Reset
          </button>
          <button type="button" className={styles.confirm} onClick={onNewGame}>
            New puzzle
          </button>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Verify the build compiles**

Run: `npm run build`
Expected: build succeeds.

- [ ] **Step 3: Commit**

```bash
git add app/GameOverDialog.js
git commit -m "$(cat <<'EOF'
Add game-over modal component

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
EOF
)"
```

---

### Task 5: Wire the mistake budget into the game

**Files:**
- Modify: `app/Game.js`

This task makes a series of targeted edits to `app/Game.js`. Apply them in order. Verified by the full test suite, `npm run build`, and manual play.

- [ ] **Step 1: Add the two component imports**

In `app/Game.js`, find:

```js
import ConfirmDialog from './ConfirmDialog'
```

Replace with:

```js
import ConfirmDialog from './ConfirmDialog'
import MistakeCounter from './MistakeCounter'
import GameOverDialog from './GameOverDialog'
```

- [ ] **Step 2: Import `isStrike`**

Find:

```js
import { mistakes as findMistakes, remainingByDigit, isSolved, lockedCells, hasEntries } from './lib/validation'
```

Replace with:

```js
import { mistakes as findMistakes, remainingByDigit, isSolved, lockedCells, hasEntries, isStrike } from './lib/validation'
```

- [ ] **Step 3: Add the `MAX_MISTAKES` constant**

Find:

```js
const EMPTY_GIVENS = Array(81).fill(0)
const DEFAULT_DIFFICULTY = 'medium'
const NO_MISTAKES = new Set()
```

Replace with:

```js
const EMPTY_GIVENS = Array(81).fill(0)
const DEFAULT_DIFFICULTY = 'medium'
const NO_MISTAKES = new Set()
const MAX_MISTAKES = 3
```

- [ ] **Step 4: Add `mistakeCount` and `gameOverDismissed` state**

Find:

```js
  const [confirm, setConfirm] = useState(null) // { message, onConfirm } | null
```

Replace with:

```js
  const [confirm, setConfirm] = useState(null) // { message, onConfirm } | null
  const [mistakeCount, setMistakeCount] = useState(0)
  const [gameOverDismissed, setGameOverDismissed] = useState(false)
```

- [ ] **Step 5: Derive `gameOver`**

Find:

```js
  const won = useMemo(
    () => ready && !making && isSolved(board, solution),
    [ready, making, board, solution]
  )
```

Replace with:

```js
  const won = useMemo(
    () => ready && !making && isSolved(board, solution),
    [ready, making, board, solution]
  )
  // Three strikes freezes the board. Never in make mode (no solution to judge).
  const gameOver = !making && mistakeCount >= MAX_MISTAKES
```

- [ ] **Step 6: Reset / restore the count in `loadOrGenerate`**

Find the whole `loadOrGenerate` body and replace it. Find:

```js
  const loadOrGenerate = useCallback(() => {
    const saved = loadGame()
    if (saved && saved.board && saved.solution) {
      dispatch({ type: 'restore', board: saved.board })
      setSolution(saved.solution)
      if (saved.difficulty) setDifficulty(saved.difficulty)
      setCategory(saved.category ?? saved.difficulty ?? DEFAULT_DIFFICULTY)
      setSolveRecorded(saved.recorded ?? false)
      setGivens(saved.board.map((c) => (c.given ? c.value : 0)))
      setSavedAt(saved.savedAt ?? 0)
    } else {
      const p = generate(DEFAULT_DIFFICULTY)
      dispatch({ type: 'newGame', givens: p.givens })
      setGivens(p.givens)
      setSolution(p.solution)
      setDifficulty(p.difficulty)
      setCategory(p.difficulty)
      setSolveRecorded(false)
      // An untouched auto-generated starter sorts as oldest, so a real
      // in-progress game on the cloud wins until the user actually plays.
      setSavedAt(0)
    }
  }, [])
```

Replace with:

```js
  const loadOrGenerate = useCallback(() => {
    const saved = loadGame()
    setGameOverDismissed(false)
    if (saved && saved.board && saved.solution) {
      dispatch({ type: 'restore', board: saved.board })
      setSolution(saved.solution)
      if (saved.difficulty) setDifficulty(saved.difficulty)
      setCategory(saved.category ?? saved.difficulty ?? DEFAULT_DIFFICULTY)
      setSolveRecorded(saved.recorded ?? false)
      setGivens(saved.board.map((c) => (c.given ? c.value : 0)))
      setSavedAt(saved.savedAt ?? 0)
      setMistakeCount(saved.mistakeCount ?? 0)
    } else {
      const p = generate(DEFAULT_DIFFICULTY)
      dispatch({ type: 'newGame', givens: p.givens })
      setGivens(p.givens)
      setSolution(p.solution)
      setDifficulty(p.difficulty)
      setCategory(p.difficulty)
      setSolveRecorded(false)
      // An untouched auto-generated starter sorts as oldest, so a real
      // in-progress game on the cloud wins until the user actually plays.
      setSavedAt(0)
      setMistakeCount(0)
    }
  }, [])
```

- [ ] **Step 7: Persist `mistakeCount`**

Find:

```js
  useEffect(() => {
    if (!ready || making) return
    saveGame({ board, solution, difficulty, category, recorded: solveRecorded, savedAt })
  }, [ready, making, board, solution, difficulty, category, solveRecorded, savedAt])
```

Replace with:

```js
  useEffect(() => {
    if (!ready || making) return
    saveGame({ board, solution, difficulty, category, recorded: solveRecorded, savedAt, mistakeCount })
  }, [ready, making, board, solution, difficulty, category, solveRecorded, savedAt, mistakeCount])
```

- [ ] **Step 8: Adopt `mistakeCount` on sync**

Find:

```js
          setSolveRecorded(merged.savegame.recorded ?? false)
          setGivens(merged.savegame.board.map((c) => (c.given ? c.value : 0)))
          setSavedAt(merged.savegame.savedAt ?? Date.now())
```

Replace with:

```js
          setSolveRecorded(merged.savegame.recorded ?? false)
          setGivens(merged.savegame.board.map((c) => (c.given ? c.value : 0)))
          setSavedAt(merged.savegame.savedAt ?? Date.now())
          setMistakeCount(merged.savegame.mistakeCount ?? 0)
          setGameOverDismissed(false)
```

- [ ] **Step 9: Strike + freeze in `handleDigit`**

Find:

```js
  function handleDigit(d) {
    if (selectedIndex == null || locked.has(selectedIndex)) return
    if (notesMode) {
      dispatchAndStamp({ type: 'toggleNote', index: selectedIndex, value: d })
    } else {
      dispatchAndStamp({ type: 'setValue', index: selectedIndex, value: d })
      setHighlightDigit(d)
    }
  }
```

Replace with:

```js
  function handleDigit(d) {
    if (selectedIndex == null || locked.has(selectedIndex) || gameOver) return
    if (notesMode) {
      dispatchAndStamp({ type: 'toggleNote', index: selectedIndex, value: d })
    } else {
      if (isStrike(board[selectedIndex].value, d, solution[selectedIndex])) {
        setMistakeCount((c) => c + 1)
      }
      dispatchAndStamp({ type: 'setValue', index: selectedIndex, value: d })
      setHighlightDigit(d)
    }
  }
```

- [ ] **Step 10: Freeze in `handleErase`**

Find:

```js
  function handleErase() {
    if (selectedIndex == null || locked.has(selectedIndex)) return
    dispatchAndStamp({ type: 'clearCell', index: selectedIndex })
  }
```

Replace with:

```js
  function handleErase() {
    if (selectedIndex == null || locked.has(selectedIndex) || gameOver) return
    dispatchAndStamp({ type: 'clearCell', index: selectedIndex })
  }
```

- [ ] **Step 11: Reset the count in `handleNewGame`**

Find:

```js
  function handleNewGame() {
    const p = generate(difficulty)
    dispatchAndStamp({ type: 'newGame', givens: p.givens })
    setGivens(p.givens)
    setSolution(p.solution)
    setCategory(p.difficulty)
    setSolveRecorded(false)
    setSelectedIndex(null)
  }
```

Replace with:

```js
  function handleNewGame() {
    const p = generate(difficulty)
    dispatchAndStamp({ type: 'newGame', givens: p.givens })
    setGivens(p.givens)
    setSolution(p.solution)
    setCategory(p.difficulty)
    setSolveRecorded(false)
    setSelectedIndex(null)
    setMistakeCount(0)
    setGameOverDismissed(false)
  }
```

- [ ] **Step 12: Reset the count in `handleReset`**

Find:

```js
  function handleReset() {
    dispatchAndStamp({ type: 'newGame', givens })
    setSelectedIndex(null)
    // solveRecorded intentionally preserved — replaying the same puzzle must
    // not re-count toward stats.
  }
```

Replace with:

```js
  function handleReset() {
    dispatchAndStamp({ type: 'newGame', givens })
    setSelectedIndex(null)
    setMistakeCount(0)
    setGameOverDismissed(false)
    // solveRecorded intentionally preserved — replaying the same puzzle must
    // not re-count toward stats.
  }
```

- [ ] **Step 13: Reset the count in `handleMakeSudoku`**

Find:

```js
  function handleMakeSudoku() {
    dispatchAndStamp({ type: 'newGame', givens: EMPTY_GIVENS })
    setMode('make')
    setMakeMessage(null)
    setNotesMode(false)
    setSelectedIndex(null)
  }
```

Replace with:

```js
  function handleMakeSudoku() {
    dispatchAndStamp({ type: 'newGame', givens: EMPTY_GIVENS })
    setMode('make')
    setMakeMessage(null)
    setNotesMode(false)
    setSelectedIndex(null)
    setMistakeCount(0)
    setGameOverDismissed(false)
  }
```

- [ ] **Step 14: Reset the count in `handleStart`**

Find:

```js
    dispatchAndStamp({ type: 'newGame', givens: entered })
    setGivens(entered)
    setSolution(result.solution)
    setCategory('custom')
    setSolveRecorded(false)
    setMode('play')
    setMakeMessage(null)
    setSelectedIndex(null)
  }
```

Replace with:

```js
    dispatchAndStamp({ type: 'newGame', givens: entered })
    setGivens(entered)
    setSolution(result.solution)
    setCategory('custom')
    setSolveRecorded(false)
    setMode('play')
    setMakeMessage(null)
    setSelectedIndex(null)
    setMistakeCount(0)
    setGameOverDismissed(false)
  }
```

- [ ] **Step 15: Strike + freeze in the keyboard handler**

Find:

```js
  useEffect(() => {
    function onKeyDown(e) {
      if (confirm || selectedIndex == null || locked.has(selectedIndex)) return
      if (e.key >= '1' && e.key <= '9') {
        const d = Number(e.key)
        dispatchAndStamp({ type: notesMode ? 'toggleNote' : 'setValue', index: selectedIndex, value: d })
        if (!notesMode) setHighlightDigit(d)
      } else if (e.key === 'Backspace' || e.key === 'Delete') {
        dispatchAndStamp({ type: 'clearCell', index: selectedIndex })
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [selectedIndex, notesMode, dispatchAndStamp, locked, confirm])
```

Replace with:

```js
  useEffect(() => {
    function onKeyDown(e) {
      if (confirm || gameOver || selectedIndex == null || locked.has(selectedIndex)) return
      if (e.key >= '1' && e.key <= '9') {
        const d = Number(e.key)
        if (!notesMode && isStrike(board[selectedIndex].value, d, solution[selectedIndex])) {
          setMistakeCount((c) => c + 1)
        }
        dispatchAndStamp({ type: notesMode ? 'toggleNote' : 'setValue', index: selectedIndex, value: d })
        if (!notesMode) setHighlightDigit(d)
      } else if (e.key === 'Backspace' || e.key === 'Delete') {
        dispatchAndStamp({ type: 'clearCell', index: selectedIndex })
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [selectedIndex, notesMode, dispatchAndStamp, locked, confirm, gameOver, board, solution])
```

- [ ] **Step 16: Render the counter**

Find:

```js
      {won && <p className={styles.win}>Solved! 🎉</p>}
```

Replace with:

```js
      {won && <p className={styles.win}>Solved! 🎉</p>}
      {!making && <MistakeCounter count={mistakeCount} max={MAX_MISTAKES} />}
```

- [ ] **Step 17: Render the game-over modal**

Find:

```js
      {confirm && (
        <ConfirmDialog
          message={confirm.message}
          onConfirm={confirm.onConfirm}
          onCancel={() => setConfirm(null)}
        />
      )}
```

Replace with:

```js
      {confirm && (
        <ConfirmDialog
          message={confirm.message}
          onConfirm={confirm.onConfirm}
          onCancel={() => setConfirm(null)}
        />
      )}
      {gameOver && !gameOverDismissed && (
        <GameOverDialog
          onNewGame={handleNewGame}
          onReset={handleReset}
          onDismiss={() => setGameOverDismissed(true)}
        />
      )}
```

- [ ] **Step 18: Run the full test suite**

Run: `npx vitest run`
Expected: PASS — all existing logic tests plus the new `isStrike` and storage tests (Game.js has no unit tests, but its imports must resolve).

- [ ] **Step 19: Verify the production build**

Run: `npm run build`
Expected: build succeeds with no errors. (Ignore `npm run lint` — known-broken under Next 16.)

- [ ] **Step 20: Manual verification (record findings)**

Start the dev server (`npm run dev`) and confirm:
- Placing three **distinct** wrong digits (whether in one cell or spread across cells) freezes the board and shows the game-over modal; the counter reads `3 / 3` in the alert colour.
- Re-tapping the **same** wrong digit in a cell costs only one strike (the counter does not climb on repeats).
- Notes-mode entries never increment the counter.
- A correct entry never increments the counter and still locks (existing silent lock).
- After game over: keypad, physical keyboard, and erase do nothing; the board is frozen.
- Dismissing the modal (backdrop click or Escape) leaves the board frozen and visible; the Controls bar's New game / Reset still work.
- The modal's **New puzzle** and **Reset** both clear the count, unfreeze, and return the counter to `0 / 3`.
- Reloading the page on a frozen game keeps it frozen at `3 / 3` (count persisted); reloading a mid-game with 1–2 strikes preserves that count.
- Make mode shows no counter and never strikes.
- Counter and modal are legible in light and dark themes on a narrow viewport.

If a check fails, treat it as a bug to fix before completing (use systematic-debugging).

- [ ] **Step 21: Commit**

```bash
git add app/Game.js
git commit -m "$(cat <<'EOF'
Enforce a three-mistake budget with game over

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
EOF
)"
```

---

### Task 6: Update the roadmap

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Inspect the roadmap section**

Run: `grep -n "Phase" README.md`
Expected: a list of `### Phase N — …` headings. Identify the highest-numbered phase block.

- [ ] **Step 2: Add a new phase entry**

After the last phase block in `README.md`, add (using the next phase number `N` after the current highest):

```markdown
### Phase N — Fair play ✅

- [x] Three-mistake budget per puzzle: a new wrong entry costs a strike
- [x] Third strike freezes the board with a game-over modal (New puzzle / Reset)
- [x] Strike count persists across reloads and sync, closing the spam-the-cell exploit
```

- [ ] **Step 3: Commit**

```bash
git add README.md
git commit -m "$(cat <<'EOF'
Document the mistake budget in the roadmap

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
EOF
)"
```

---

## Notes on Design Decisions (for the implementer)

- **Why per-placement, not per-cell, counting:** a strike fires on each *new wrong value* (`isStrike` requires `nextValue !== prevValue`). Cycling 1→2→3 in one cell is three distinct wrong changes = three strikes, which is exactly the spam behaviour we are deterring. Re-tapping the same wrong digit is not a change, so it does not double-charge.
- **Why no `STORAGE_VERSION` bump:** `mistakeCount` is additive with a `?? 0` default. Bumping the version would make `loadGame` drop every existing v3 save (it returns `null` on version mismatch), wiping live users' in-progress games. The default read avoids that.
- **Why persist the count:** without persistence, reloading the page would reset strikes to 0 — a trivial way to dodge the budget. With it, a frozen board reloads frozen (`mistakeCount >= MAX_MISTAKES`).
- **Why `gameOver` excludes make mode:** there is no solution to judge against while building a puzzle, so strikes are meaningless there; the `!making` guard also keeps `findMistakes`/`lockedCells` suppressed, consistent with existing behaviour.
- **Why the modal is dismissible but the board stays frozen:** game over is terminal for *input*, but the player may want to study the final grid. `gameOverDismissed` hides only the modal; `gameOver` continues to gate all input. The existing Controls bar remains the way forward, so no functionality is lost by dismissing.
- **Sync needs no new code:** `mistakeCount` lives inside the savegame blob, which is already newest-board-wins via `mergeSavegame`. The merged savegame carries its own `mistakeCount`, adopted in the sync effect (Step 8).
- **Forward-compatibility with undo (next feature):** `mistakeCount` is ordinary React state. A future undo stack will snapshot board + `mistakeCount` together, so undoing an accidental wrong placement also refunds the strike — no rework of this task required.
