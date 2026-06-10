# Stats Tracking Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Track solved-puzzle counts (total + per category), a daily streak, and milestone badges, surfaced via a toast and a collapsible stats panel, persisted in localStorage.

**Architecture:** A pure, unit-tested logic module (`app/lib/stats.js`) owns the stats record shape, badge definitions, and `recordSolve`. A thin persistence layer (`app/lib/statsStorage.js`) handles localStorage I/O. The savegame (`app/lib/storage.js`) gains `category` + `recorded` fields (version bump 2 → 3) so a solve records exactly once per puzzle instance. `Game.js` records on the win transition and renders a `Toast` queue and a `StatsPanel`.

**Tech Stack:** Next.js 16 (App Router) + React 19, CSS Modules, Vitest. Logic libs are pure (no React); tests are colocated `*.test.js` using `import { describe, it, expect } from 'vitest'`. There is no component-test framework (no jsdom/RTL) — UI is verified via `npm run build` + manual play.

**Conventions:**
- Board cells are `{ value: 1-9 | null, given: boolean, notes: number[] }`.
- Commit messages are plain descriptive sentences (no `feat:`/`fix:` prefixes), ending with the trailer:
  ```
  Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
  ```
- Run the full suite with `npm test` (alias for `vitest run`); a single file with `npx vitest run <path>`.

---

### Task 1: Stats record shape + date helpers

**Files:**
- Create: `app/lib/stats.js`
- Test: `app/lib/stats.test.js`

- [ ] **Step 1: Write the failing test**

Create `app/lib/stats.test.js`:

```js
import { describe, it, expect } from 'vitest'
import { defaultStats, todayLocal, yesterday } from './stats'

describe('defaultStats', () => {
  it('returns a zeroed record with the documented shape', () => {
    const s = defaultStats()
    expect(s.version).toBe(1)
    expect(s.solved).toEqual({ total: 0, easy: 0, medium: 0, hard: 0, custom: 0 })
    expect(s.streak).toEqual({ current: 0, best: 0, lastSolveDate: null })
    expect(s.daily).toEqual({ date: null, count: 0 })
    expect(s.badges).toEqual([])
  })
})

describe('yesterday', () => {
  it('returns the previous calendar day', () => {
    expect(yesterday('2026-03-02')).toBe('2026-03-01')
  })
  it('crosses a month boundary', () => {
    expect(yesterday('2026-03-01')).toBe('2026-02-28')
  })
  it('crosses a year boundary', () => {
    expect(yesterday('2026-01-01')).toBe('2025-12-31')
  })
})

describe('todayLocal', () => {
  it('formats as YYYY-MM-DD', () => {
    expect(todayLocal()).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run app/lib/stats.test.js`
Expected: FAIL — cannot resolve `./stats` / functions not exported.

- [ ] **Step 3: Write the minimal implementation**

Create `app/lib/stats.js`:

```js
// Pure stats logic: record shape, badge rules, and recordSolve. No React, no
// localStorage. The only clock access is todayLocal(); everything else takes an
// explicit date so it is deterministically testable.

export const STATS_VERSION = 1

export function defaultStats() {
  return {
    version: STATS_VERSION,
    solved: { total: 0, easy: 0, medium: 0, hard: 0, custom: 0 },
    streak: { current: 0, best: 0, lastSolveDate: null },
    daily: { date: null, count: 0 },
    badges: [],
  }
}

function formatLocal(d) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

// Local date as 'YYYY-MM-DD'.
export function todayLocal() {
  return formatLocal(new Date())
}

// The calendar day before dateStr ('YYYY-MM-DD'), without timezone drift.
// Build the date at local noon so a DST transition can't shift the day.
export function yesterday(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number)
  const dt = new Date(y, m - 1, d, 12, 0, 0)
  dt.setDate(dt.getDate() - 1)
  return formatLocal(dt)
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run app/lib/stats.test.js`
Expected: PASS (all `defaultStats`/`yesterday`/`todayLocal` cases green).

- [ ] **Step 5: Commit**

```bash
git add app/lib/stats.js app/lib/stats.test.js
git commit -m "$(cat <<'EOF'
Add stats record shape and date helpers

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
EOF
)"
```

---

### Task 2: Badge definitions + recordSolve

**Files:**
- Modify: `app/lib/stats.js`
- Test: `app/lib/stats.test.js`

- [ ] **Step 1: Write the failing test**

Append to `app/lib/stats.test.js`:

```js
import { recordSolve, BADGES } from './stats'

describe('BADGES', () => {
  it('defines the total and day milestones', () => {
    const ids = BADGES.map((b) => b.id)
    expect(ids).toEqual([
      'solve-10', 'solve-50', 'solve-75', 'solve-100', 'solve-150', 'solve-200',
      'day-2', 'day-5', 'day-8', 'day-10',
    ])
  })
})

describe('recordSolve counts', () => {
  it('increments total and the named category', () => {
    const { stats } = recordSolve(defaultStats(), { category: 'easy', date: '2026-06-01' })
    expect(stats.solved.total).toBe(1)
    expect(stats.solved.easy).toBe(1)
    expect(stats.solved.medium).toBe(0)
  })
  it('counts make-mode solves under custom', () => {
    const { stats } = recordSolve(defaultStats(), { category: 'custom', date: '2026-06-01' })
    expect(stats.solved.custom).toBe(1)
    expect(stats.solved.total).toBe(1)
  })
  it('does not mutate the input record', () => {
    const base = defaultStats()
    recordSolve(base, { category: 'hard', date: '2026-06-01' })
    expect(base.solved.total).toBe(0)
  })
})

describe('recordSolve streak', () => {
  it('first solve sets current and best to 1', () => {
    const { stats } = recordSolve(defaultStats(), { category: 'easy', date: '2026-06-01' })
    expect(stats.streak.current).toBe(1)
    expect(stats.streak.best).toBe(1)
    expect(stats.streak.lastSolveDate).toBe('2026-06-01')
  })
  it('a same-day second solve leaves the streak unchanged but still counts', () => {
    let s = recordSolve(defaultStats(), { category: 'easy', date: '2026-06-01' }).stats
    const { stats } = recordSolve(s, { category: 'medium', date: '2026-06-01' })
    expect(stats.streak.current).toBe(1)
    expect(stats.solved.total).toBe(2)
    expect(stats.daily.count).toBe(2)
  })
  it('a consecutive day increments the streak', () => {
    let s = recordSolve(defaultStats(), { category: 'easy', date: '2026-06-01' }).stats
    s = recordSolve(s, { category: 'easy', date: '2026-06-02' }).stats
    expect(s.streak.current).toBe(2)
    expect(s.streak.best).toBe(2)
  })
  it('a gap resets current to 1 but keeps best', () => {
    let s = recordSolve(defaultStats(), { category: 'easy', date: '2026-06-01' }).stats
    s = recordSolve(s, { category: 'easy', date: '2026-06-02' }).stats
    s = recordSolve(s, { category: 'easy', date: '2026-06-05' }).stats
    expect(s.streak.current).toBe(1)
    expect(s.streak.best).toBe(2)
  })
})

describe('recordSolve daily count', () => {
  it('resets the daily count on a new day', () => {
    let s = recordSolve(defaultStats(), { category: 'easy', date: '2026-06-01' }).stats
    expect(s.daily).toEqual({ date: '2026-06-01', count: 1 })
    s = recordSolve(s, { category: 'easy', date: '2026-06-02' }).stats
    expect(s.daily).toEqual({ date: '2026-06-02', count: 1 })
  })
})

describe('recordSolve badges', () => {
  it('awards a total badge when the threshold is crossed, exactly once', () => {
    const s = defaultStats()
    s.solved = { total: 9, easy: 9, medium: 0, hard: 0, custom: 0 }
    const first = recordSolve(s, { category: 'easy', date: '2026-06-01' })
    expect(first.newBadges.map((b) => b.id)).toContain('solve-10')
    const second = recordSolve(first.stats, { category: 'easy', date: '2026-06-01' })
    expect(second.newBadges.map((b) => b.id)).not.toContain('solve-10')
  })
  it('awards a day badge when enough solves happen in one day', () => {
    let s = defaultStats()
    let last
    for (let i = 0; i < 2; i++) {
      last = recordSolve(s, { category: 'easy', date: '2026-06-01' })
      s = last.stats
    }
    expect(last.newBadges.map((b) => b.id)).toContain('day-2')
  })
  it('can award multiple badges in a single solve', () => {
    const s = defaultStats()
    s.solved = { total: 49, easy: 49, medium: 0, hard: 0, custom: 0 }
    s.daily = { date: '2026-06-01', count: 1 }
    s.badges = ['solve-10']
    const { newBadges } = recordSolve(s, { category: 'easy', date: '2026-06-01' })
    const ids = newBadges.map((b) => b.id)
    expect(ids).toContain('solve-50')
    expect(ids).toContain('day-2')
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run app/lib/stats.test.js`
Expected: FAIL — `recordSolve` / `BADGES` not exported.

- [ ] **Step 3: Write the minimal implementation**

Append to `app/lib/stats.js`:

```js
export const BADGES = [
  { id: 'solve-10', kind: 'total', threshold: 10, label: 'Solved 10 puzzles' },
  { id: 'solve-50', kind: 'total', threshold: 50, label: 'Solved 50 puzzles' },
  { id: 'solve-75', kind: 'total', threshold: 75, label: 'Solved 75 puzzles' },
  { id: 'solve-100', kind: 'total', threshold: 100, label: 'Solved 100 puzzles' },
  { id: 'solve-150', kind: 'total', threshold: 150, label: 'Solved 150 puzzles' },
  { id: 'solve-200', kind: 'total', threshold: 200, label: 'Solved 200 puzzles' },
  { id: 'day-2', kind: 'day', threshold: 2, label: '2 puzzles in a day' },
  { id: 'day-5', kind: 'day', threshold: 5, label: '5 puzzles in a day' },
  { id: 'day-8', kind: 'day', threshold: 8, label: '8 puzzles in a day' },
  { id: 'day-10', kind: 'day', threshold: 10, label: '10 puzzles in a day' },
]

// Record one solve. Returns a NEW stats object plus any badges newly earned by
// this solve (empty when none). `date` is a local 'YYYY-MM-DD' string supplied
// by the caller. `category` is one of easy|medium|hard|custom.
export function recordSolve(stats, { category, date }) {
  const next = {
    version: STATS_VERSION,
    solved: { ...stats.solved },
    streak: { ...stats.streak },
    daily: { ...stats.daily },
    badges: [...stats.badges],
  }

  // Counts.
  next.solved.total += 1
  next.solved[category] += 1

  // Streak: unchanged if already solved today; +1 if yesterday was the last
  // solve; otherwise restart at 1.
  if (next.streak.lastSolveDate === date) {
    // already solved today — leave current as is
  } else if (next.streak.lastSolveDate === yesterday(date)) {
    next.streak.current += 1
  } else {
    next.streak.current = 1
  }
  next.streak.best = Math.max(next.streak.best, next.streak.current)
  next.streak.lastSolveDate = date

  // Daily count for the current calendar day.
  if (next.daily.date === date) {
    next.daily.count += 1
  } else {
    next.daily = { date, count: 1 }
  }

  // Newly earned badges (against the post-increment totals).
  const earned = new Set(next.badges)
  const newBadges = []
  for (const badge of BADGES) {
    if (earned.has(badge.id)) continue
    const met =
      badge.kind === 'total'
        ? badge.threshold <= next.solved.total
        : badge.threshold <= next.daily.count
    if (met) {
      next.badges.push(badge.id)
      newBadges.push(badge)
    }
  }

  return { stats: next, newBadges }
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run app/lib/stats.test.js`
Expected: PASS (all count/streak/daily/badge cases green).

- [ ] **Step 5: Commit**

```bash
git add app/lib/stats.js app/lib/stats.test.js
git commit -m "$(cat <<'EOF'
Add badge definitions and recordSolve

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
EOF
)"
```

---

### Task 3: Stats persistence layer

**Files:**
- Create: `app/lib/statsStorage.js`
- Test: `app/lib/statsStorage.test.js`

- [ ] **Step 1: Write the failing test**

Create `app/lib/statsStorage.test.js`:

```js
import { describe, it, expect, beforeEach } from 'vitest'
import { loadStats, saveStats, clearStats } from './statsStorage'
import { defaultStats } from './stats'

// Vitest runs in a node environment with no localStorage. Provide a minimal
// in-memory mock so the persistence layer can be tested.
function mockLocalStorage() {
  const store = new Map()
  return {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => store.set(k, String(v)),
    removeItem: (k) => store.delete(k),
  }
}

beforeEach(() => {
  globalThis.localStorage = mockLocalStorage()
})

describe('statsStorage', () => {
  it('returns default stats when nothing is stored', () => {
    expect(loadStats()).toEqual(defaultStats())
  })
  it('round-trips a saved record', () => {
    const s = defaultStats()
    s.solved.total = 7
    saveStats(s)
    expect(loadStats().solved.total).toBe(7)
  })
  it('returns default stats on a version mismatch', () => {
    localStorage.setItem('sudoku-cloud:stats', JSON.stringify({ version: 999 }))
    expect(loadStats()).toEqual(defaultStats())
  })
  it('returns default stats on corrupt JSON', () => {
    localStorage.setItem('sudoku-cloud:stats', '{not json')
    expect(loadStats()).toEqual(defaultStats())
  })
  it('clearStats removes the record', () => {
    saveStats(defaultStats())
    clearStats()
    expect(localStorage.getItem('sudoku-cloud:stats')).toBe(null)
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run app/lib/statsStorage.test.js`
Expected: FAIL — cannot resolve `./statsStorage`.

- [ ] **Step 3: Write the minimal implementation**

Create `app/lib/statsStorage.js`:

```js
import { defaultStats, STATS_VERSION } from './stats'

const KEY = 'sudoku-cloud:stats'

export function loadStats() {
  if (typeof localStorage === 'undefined') return defaultStats()
  const raw = localStorage.getItem(KEY)
  if (!raw) return defaultStats()
  try {
    const data = JSON.parse(raw)
    if (data.version !== STATS_VERSION) return defaultStats()
    return data
  } catch {
    return defaultStats()
  }
}

export function saveStats(stats) {
  if (typeof localStorage === 'undefined') return
  localStorage.setItem(KEY, JSON.stringify(stats))
}

export function clearStats() {
  if (typeof localStorage === 'undefined') return
  localStorage.removeItem(KEY)
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run app/lib/statsStorage.test.js`
Expected: PASS (all 5 cases green).

- [ ] **Step 5: Commit**

```bash
git add app/lib/statsStorage.js app/lib/statsStorage.test.js
git commit -m "$(cat <<'EOF'
Add localStorage persistence for stats

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
EOF
)"
```

---

### Task 4: Savegame v3 — category + recorded fields

**Files:**
- Modify: `app/lib/storage.js`
- Test: `app/lib/storage.test.js` (create)

- [ ] **Step 1: Write the failing test**

Create `app/lib/storage.test.js`:

```js
import { describe, it, expect, beforeEach } from 'vitest'
import { saveGame, loadGame, STORAGE_VERSION } from './storage'

function mockLocalStorage() {
  const store = new Map()
  return {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => store.set(k, String(v)),
    removeItem: (k) => store.delete(k),
  }
}

beforeEach(() => {
  globalThis.localStorage = mockLocalStorage()
})

describe('savegame persistence', () => {
  it('is at version 3', () => {
    expect(STORAGE_VERSION).toBe(3)
  })
  it('round-trips category and recorded', () => {
    saveGame({
      board: [{ value: 1, given: true, notes: [] }],
      solution: [1],
      difficulty: 'hard',
      category: 'custom',
      recorded: true,
    })
    const loaded = loadGame()
    expect(loaded.difficulty).toBe('hard')
    expect(loaded.category).toBe('custom')
    expect(loaded.recorded).toBe(true)
  })
  it('drops a record from an older version', () => {
    localStorage.setItem(
      'sudoku-cloud:savegame',
      JSON.stringify({ version: 2, board: [], solution: [] })
    )
    expect(loadGame()).toBe(null)
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run app/lib/storage.test.js`
Expected: FAIL — `STORAGE_VERSION` is 2, and `loaded.category`/`recorded` are `undefined`.

- [ ] **Step 3: Write the implementation**

Replace the entire contents of `app/lib/storage.js` with:

```js
const KEY = 'sudoku-cloud:savegame';
export const STORAGE_VERSION = 3;

export function saveGame({ board, solution, difficulty, category, recorded }) {
  if (typeof localStorage === 'undefined') return;
  const payload = JSON.stringify({
    version: STORAGE_VERSION,
    board,
    solution,
    difficulty,
    category,
    recorded,
  });
  localStorage.setItem(KEY, payload);
}

export function loadGame() {
  if (typeof localStorage === 'undefined') return null;
  const raw = localStorage.getItem(KEY);
  if (!raw) return null;
  try {
    const data = JSON.parse(raw);
    if (data.version !== STORAGE_VERSION) return null;
    return {
      board: data.board,
      solution: data.solution,
      difficulty: data.difficulty,
      category: data.category ?? data.difficulty ?? null,
      recorded: data.recorded ?? false,
    };
  } catch {
    return null;
  }
}

export function clearGame() {
  if (typeof localStorage === 'undefined') return;
  localStorage.removeItem(KEY);
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run app/lib/storage.test.js`
Expected: PASS (all 3 cases green).

- [ ] **Step 5: Run the full suite to confirm nothing regressed**

Run: `npm test`
Expected: PASS — all prior tests plus the new stats/storage tests.

- [ ] **Step 6: Commit**

```bash
git add app/lib/storage.js app/lib/storage.test.js
git commit -m "$(cat <<'EOF'
Add category and recorded fields to savegame (v3)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
EOF
)"
```

---

### Task 5: Stats panel component

**Files:**
- Create: `app/StatsPanel.js`
- Modify: `app/page.module.css`

No component-test framework exists; this task is verified by `npm run build` and (later) manual play. Follow the existing client-component patterns (`ThemeToggle.js`, `Controls.js`).

- [ ] **Step 1: Add the panel styles**

Append to `app/page.module.css`:

```css
.stats {
  margin-top: 1.5rem;
  width: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
}

.statsToggle {
  padding: 0.4rem 0.8rem;
  cursor: pointer;
  background: var(--surface);
  color: var(--text);
  border: 1px solid var(--cell-border);
  border-radius: 6px;
}

.statsBody {
  margin-top: 0.75rem;
  width: 100%;
  text-align: center;
}

.statLine {
  margin: 0.25rem 0;
  color: var(--text);
  font-weight: bold;
}

.statBreakdown {
  margin: 0.25rem 0 0.75rem;
  color: var(--muted);
  font-size: 0.9rem;
}

.badgeGrid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 0.5rem;
}

.badge {
  padding: 0.4rem 0.5rem;
  border: 1px solid var(--cell-border);
  border-radius: 6px;
  font-size: 0.8rem;
  text-align: center;
}

.badgeEarned {
  background: var(--accent-bg);
  color: var(--text);
  font-weight: bold;
}

.badgeLocked {
  color: var(--muted);
  opacity: 0.5;
}
```

- [ ] **Step 2: Create the component**

Create `app/StatsPanel.js`:

```js
'use client'
import { useState } from 'react'
import { BADGES } from './lib/stats'
import styles from './page.module.css'

// Collapsible stats display: streak, solved counts, and the badge grid.
// Default collapsed to keep the play screen clean. Pure presentational —
// reads only from `stats`.
export default function StatsPanel({ stats }) {
  const [open, setOpen] = useState(false)
  const earned = new Set(stats.badges)

  return (
    <div className={styles.stats}>
      <button
        type="button"
        className={styles.statsToggle}
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
      >
        {open ? 'Hide stats' : 'Stats'}
      </button>
      {open && (
        <div className={styles.statsBody}>
          <p className={styles.statLine}>
            Streak: {stats.streak.current} (best {stats.streak.best})
          </p>
          <p className={styles.statLine}>Solved: {stats.solved.total}</p>
          <p className={styles.statBreakdown}>
            Easy {stats.solved.easy} · Medium {stats.solved.medium} · Hard{' '}
            {stats.solved.hard} · Custom {stats.solved.custom}
          </p>
          <div className={styles.badgeGrid}>
            {BADGES.map((b) => (
              <div
                key={b.id}
                className={`${styles.badge} ${
                  earned.has(b.id) ? styles.badgeEarned : styles.badgeLocked
                }`}
                title={b.label}
              >
                {b.label}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 3: Verify the build compiles**

Run: `npm run build`
Expected: build succeeds (the component is not yet rendered anywhere, but it must compile and lint clean).

- [ ] **Step 4: Commit**

```bash
git add app/StatsPanel.js app/page.module.css
git commit -m "$(cat <<'EOF'
Add collapsible stats panel component

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
EOF
)"
```

---

### Task 6: Toast component

**Files:**
- Create: `app/Toast.js`
- Modify: `app/page.module.css`

Verified by `npm run build` + manual play.

- [ ] **Step 1: Add the toast styles**

Append to `app/page.module.css`:

```css
.toastContainer {
  position: fixed;
  top: 1rem;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  z-index: 50;
  pointer-events: none;
}

.toast {
  background: var(--surface);
  color: var(--text);
  border: 1px solid var(--cell-border);
  border-left: 4px solid var(--win);
  border-radius: 6px;
  padding: 0.5rem 0.9rem;
  font-weight: bold;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
}
```

- [ ] **Step 2: Create the component**

Create `app/Toast.js`:

```js
'use client'
import { useEffect } from 'react'
import styles from './page.module.css'

// One toast that dismisses itself after a few seconds.
function ToastItem({ toast, onDismiss }) {
  useEffect(() => {
    const t = setTimeout(() => onDismiss(toast.id), 4000)
    return () => clearTimeout(t)
  }, [toast.id, onDismiss])
  return <div className={styles.toast}>{toast.text}</div>
}

// A queue of transient messages. Renders nothing when empty. `toasts` is an
// array of { id, text }; `onDismiss(id)` removes one. `onDismiss` must be a
// stable reference (e.g. useCallback) so item timers are not reset on every
// parent render.
export default function Toast({ toasts, onDismiss }) {
  if (!toasts.length) return null
  return (
    <div className={styles.toastContainer}>
      {toasts.map((t) => (
        <ToastItem key={t.id} toast={t} onDismiss={onDismiss} />
      ))}
    </div>
  )
}
```

- [ ] **Step 3: Verify the build compiles**

Run: `npm run build`
Expected: build succeeds.

- [ ] **Step 4: Commit**

```bash
git add app/Toast.js app/page.module.css
git commit -m "$(cat <<'EOF'
Add auto-dismissing toast queue component

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
EOF
)"
```

---

### Task 7: Wire stats into the game

**Files:**
- Modify: `app/Game.js`

Verified by `npm run build`, the full test suite, and manual play.

- [ ] **Step 1: Replace `app/Game.js`**

Replace the entire contents of `app/Game.js` with:

```js
'use client'
import { useReducer, useMemo, useState, useEffect, useCallback } from 'react'
import Board from './Board'
import Keypad from './Keypad'
import Controls from './Controls'
import DifficultySelect from './DifficultySelect'
import ThemeToggle from './ThemeToggle'
import StatsPanel from './StatsPanel'
import Toast from './Toast'
import { createBoard } from './lib/board'
import { boardReducer } from './lib/reducer'
import { mistakes as findMistakes, remainingByDigit, isSolved } from './lib/validation'
import { sameNumberCells } from './lib/highlight'
import { generate } from './lib/generator'
import { validatePuzzle } from './lib/makepuzzle'
import { loadGame, saveGame } from './lib/storage'
import { loadStats, saveStats } from './lib/statsStorage'
import { recordSolve, todayLocal } from './lib/stats'
import styles from './page.module.css'

const EMPTY_GIVENS = Array(81).fill(0)
const DEFAULT_DIFFICULTY = 'medium'
const NO_MISTAKES = new Set()

// Monotonic id source for toast messages (module-level so it survives renders).
let toastSeq = 0

export default function Game() {
  const [board, dispatch] = useReducer(boardReducer, EMPTY_GIVENS, createBoard)
  const [givens, setGivens] = useState(EMPTY_GIVENS)
  const [solution, setSolution] = useState(EMPTY_GIVENS)
  const [difficulty, setDifficulty] = useState(DEFAULT_DIFFICULTY)
  const [category, setCategory] = useState(DEFAULT_DIFFICULTY)
  const [selectedIndex, setSelectedIndex] = useState(null)
  const [notesMode, setNotesMode] = useState(false)
  const [ready, setReady] = useState(false)
  const [mode, setMode] = useState('play')
  const [makeMessage, setMakeMessage] = useState(null)
  const [stats, setStats] = useState(null)
  const [solveRecorded, setSolveRecorded] = useState(false)
  const [toasts, setToasts] = useState([])

  const making = mode === 'make'
  const mistakes = useMemo(
    () => (making ? NO_MISTAKES : findMistakes(board, solution)),
    [making, board, solution]
  )
  const sameNumber = useMemo(
    () => sameNumberCells(board, selectedIndex),
    [board, selectedIndex]
  )
  const remaining = useMemo(() => remainingByDigit(board), [board])
  const won = useMemo(
    () => ready && !making && isSolved(board, solution),
    [ready, making, board, solution]
  )

  const dismissToast = useCallback((id) => {
    setToasts((list) => list.filter((t) => t.id !== id))
  }, [])

  const pushToast = useCallback((text) => {
    setToasts((list) => [...list, { id: ++toastSeq, text }])
  }, [])

  // Restore a saved game, or generate a fresh default puzzle. Used on mount
  // and when cancelling make mode.
  const loadOrGenerate = useCallback(() => {
    const saved = loadGame()
    if (saved && saved.board && saved.solution) {
      dispatch({ type: 'restore', board: saved.board })
      setSolution(saved.solution)
      if (saved.difficulty) setDifficulty(saved.difficulty)
      setCategory(saved.category ?? saved.difficulty ?? DEFAULT_DIFFICULTY)
      setSolveRecorded(saved.recorded ?? false)
      setGivens(saved.board.map((c) => (c.given ? c.value : 0)))
    } else {
      const p = generate(DEFAULT_DIFFICULTY)
      dispatch({ type: 'newGame', givens: p.givens })
      setGivens(p.givens)
      setSolution(p.solution)
      setDifficulty(p.difficulty)
      setCategory(p.difficulty)
      setSolveRecorded(false)
    }
  }, [])

  // On mount: restore or generate, and load stats.
  useEffect(() => {
    loadOrGenerate()
    setStats(loadStats())
    setReady(true)
  }, [loadOrGenerate])

  // Persist the game after ready — but never while making a puzzle.
  useEffect(() => {
    if (!ready || making) return
    saveGame({ board, solution, difficulty, category, recorded: solveRecorded })
  }, [ready, making, board, solution, difficulty, category, solveRecorded])

  // Record a solve exactly once per puzzle instance, then toast any new badges.
  useEffect(() => {
    if (!ready || making || !won || solveRecorded || !stats) return
    const { stats: next, newBadges } = recordSolve(stats, {
      category,
      date: todayLocal(),
    })
    setStats(next)
    saveStats(next)
    setSolveRecorded(true)
    for (const badge of newBadges) pushToast(`🏅 ${badge.label}!`)
  }, [ready, making, won, solveRecorded, stats, category, pushToast])

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
    setCategory(p.difficulty)
    setSolveRecorded(false)
    setSelectedIndex(null)
  }

  function handleReset() {
    dispatch({ type: 'newGame', givens })
    setSelectedIndex(null)
    // solveRecorded intentionally preserved — replaying the same puzzle must
    // not re-count toward stats.
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
    setCategory('custom')
    setSolveRecorded(false)
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
      <ThemeToggle />
      <Toast toasts={toasts} onDismiss={dismissToast} />
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
        sameNumber={sameNumber}
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
      {!making && stats && <StatsPanel stats={stats} />}
    </div>
  )
}
```

- [ ] **Step 2: Run the full test suite**

Run: `npm test`
Expected: PASS — all logic tests still green (Game.js has no unit tests, but its imports must resolve).

- [ ] **Step 3: Verify the production build**

Run: `npm run build`
Expected: build succeeds with no errors.

- [ ] **Step 4: Manual verification (record findings)**

Start the dev server (`npm run dev`) and confirm:
- Solving a generated puzzle increments Solved (total + the right category) in the panel; reloading the finished board does **not** double-count.
- The "Stats" toggle opens/closes the panel; counts, streak, and the badge grid render and are legible in both light and dark themes on a narrow viewport.
- Crossing a milestone (e.g. seed `localStorage['sudoku-cloud:stats']` to `total: 9` then solve) shows a toast that auto-dismisses after ~4s, and the badge then reads as earned.
- Reset-then-resolve of an already-solved puzzle does not increment counts.

If a check fails, treat it as a bug to fix before completing (use systematic-debugging).

- [ ] **Step 5: Commit**

```bash
git add app/Game.js
git commit -m "$(cat <<'EOF'
Record solves and surface stats in the game

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
EOF
)"
```

---

### Task 8: Update the roadmap

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Add a Phase 5 entry**

In `README.md`, after the Phase 4 block (ends at the keyboard-navigation line), add:

```markdown
### Phase 5 — Progress & stats ✅

- [x] Solved-puzzle counts (total + per category: easy/medium/hard/custom)
- [x] Daily streak (consecutive days with a solve)
- [x] Milestone badges (total solved + solves-in-a-day), celebrated with a toast
- [x] localStorage-backed, structured for a future per-user login
```

- [ ] **Step 2: Commit**

```bash
git add README.md
git commit -m "$(cat <<'EOF'
Document stats tracking in the roadmap

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
EOF
)"
```

---

## Notes on Design Decisions (for the implementer)

- **Why `category` is separate from `difficulty`:** `difficulty` drives the generator and the difficulty selector UI; `category` is the stats bucket. They're equal for generated games but diverge for make-mode (`category: 'custom'`, while `difficulty` keeps whatever the selector showed). Keeping both avoids overloading one field.
- **Why the record effect can't double-count:** after `recordSolve`, both `setSolveRecorded(true)` and `setStats(next)` re-render; the effect re-runs but the `solveRecorded` guard now short-circuits. The `recorded` flag is also persisted via the save effect, so reloading a finished board re-hydrates `solveRecorded: true` and never re-records.
- **Why `onDismiss`/`pushToast` use `useCallback`:** `ToastItem`'s dismissal timer lives in a `useEffect` keyed on `onDismiss`; an unstable reference would clear and reset every timer on each parent render.
- **`stats` is `null` until mount:** `StatsPanel` is only rendered once `stats` is loaded (`!making && stats && …`), and the record effect guards on `!stats`, so there is no SSR/first-paint access to a null record.
```
