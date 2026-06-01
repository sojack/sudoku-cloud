# Stats Tracking Design

Date: 2026-06-01

## Goal

Track per-player progress in the Sudoku app: solved-puzzle counts (total and by
category), a daily streak, and milestone badges — celebrated with a toast and
shown in a stats panel. Backed by localStorage now, structured so a future login
system can namespace or sync the same data per user without rewriting logic.

## Decisions

- **What counts:** every solved puzzle counts, bucketed by category. Generated
  puzzles count under their difficulty (`easy`/`medium`/`hard`); make-mode
  (hand-entered) puzzles count under `custom`. All categories sum into `total`.
- **Streak rule:** `current` = consecutive local-calendar days with at least one
  solve. Solving again the same day does not change the streak. Missing a full
  day resets `current` to 1 on the next solve. `best` tracks the maximum
  `current` ever reached.
- **Badges:** earned-once and permanent.
  - Total solved: `solve-10`, `solve-50`, `solve-75`, `solve-100`, `solve-150`,
    `solve-200`.
  - Solves in a single day: `day-2`, `day-5`, `day-8`, `day-10`. A day badge,
    once earned, stays earned forever even after the day's count resets.
- **Anti-farming:** a solve records exactly once per puzzle instance. **New
  Game** and **Start** (make-mode) begin a fresh instance; **Reset** replays the
  same puzzle and must not allow re-counting.
- **Surfacing:** a transient toast on solve (announcing any newly earned
  badges), plus a collapsible stats panel (default collapsed) on the main
  screen. The existing persistent "Solved! 🎉" win line is unchanged.
- **Storage:** stats live at their own key, separate from the savegame, so
  replacing or clearing a game never touches lifetime stats.

## Data Model

Stored at localStorage key `sudoku-cloud:stats`, versioned `STATS_VERSION = 1`:

```js
{
  version: 1,
  solved:  { total: 0, easy: 0, medium: 0, hard: 0, custom: 0 },
  streak:  { current: 0, best: 0, lastSolveDate: null }, // 'YYYY-MM-DD' local | null
  daily:   { date: null, count: 0 },                     // count of solves on `date`
  badges:  []                                            // earned badge IDs (strings)
}
```

`category` is one of `'easy' | 'medium' | 'hard' | 'custom'`.

## Logic Library — `app/lib/stats.js` (new, pure, unit-tested, no React)

- **`defaultStats()`** → a fresh record matching the shape above.
- **`BADGES`** → array of badge definitions, each
  `{ id, kind: 'total' | 'day', threshold, label }`:
  - total: `solve-10`/`50`/`75`/`100`/`150`/`200` with labels like
    `"Solved 10 puzzles"`.
  - day: `day-2`/`5`/`8`/`10` with labels like `"2 puzzles in a day"`.
- **`recordSolve(stats, { category, date })`** → `{ stats, newBadges }`:
  - `date` is a local `'YYYY-MM-DD'` string supplied by the caller (function
    stays pure — no clock access inside).
  - Returns a NEW stats object (does not mutate the input).
  - Increments `solved.total` and `solved[category]` by 1.
  - **Streak:** if `streak.lastSolveDate === date` → streak unchanged; else if
    `streak.lastSolveDate === yesterday(date)` → `current + 1`; else
    `current = 1`. Then `best = max(best, current)` and `lastSolveDate = date`.
  - **Daily:** if `daily.date === date` → `count + 1`; else
    `{ date, count: 1 }`.
  - **Badges:** collect every `BADGES` entry not already in `stats.badges` whose
    threshold is now met — `kind === 'total'` met when `threshold <= solved.total`,
    `kind === 'day'` met when `threshold <= daily.count` (the post-increment
    values). Append their ids to `badges`; return the full definition objects as
    `newBadges` (possibly empty, possibly several at once).
- **`todayLocal()`** → local date as `'YYYY-MM-DD'` (uses the system clock; the
  only impure helper, kept thin so callers can test `recordSolve` with fixed
  dates).
- **`yesterday(dateStr)`** → the `'YYYY-MM-DD'` one calendar day before
  `dateStr`, computed without timezone drift (parse to a local Date at noon,
  subtract a day, reformat).

## Persistence — `app/lib/statsStorage.js` (new)

Mirrors `storage.js`. SSR-safe (`typeof localStorage === 'undefined'` guard).

- **`loadStats()`** → the stored record, or `defaultStats()` when absent,
  unparseable, or a version mismatch (forward-compat: unknown version →
  `defaultStats()`).
- **`saveStats(stats)`** → JSON-serialize to `sudoku-cloud:stats`.
- **`clearStats()`** → remove the key.

`stats.js` stays pure; all localStorage I/O lives here.

## Savegame Changes — `app/lib/storage.js`

Bump `STORAGE_VERSION` 2 → 3. The persisted payload gains two fields:

- **`category`** — `'easy' | 'medium' | 'hard' | 'custom'`, the stats bucket for
  this puzzle.
- **`recorded`** — boolean, whether this puzzle instance's solve has already been
  counted.

`saveGame({ board, solution, difficulty, category, recorded })` writes both;
`loadGame()` returns them (defaulting `recorded` to `false` and `category` to the
saved `difficulty` if missing, though a v2→v3 bump makes old saves load as `null`
and regenerate). Old v2 saves fail the version check and are dropped — acceptable
(a fresh puzzle generates).

## React Integration — `app/Game.js`

New state:

- `stats` — loaded via `loadStats()` on mount (inside the existing `ready`
  effect, alongside `loadOrGenerate`).
- `category` — the current puzzle's stats bucket. Set when a puzzle begins:
  generated games (`loadOrGenerate`, `handleNewGame`) → the difficulty; make-mode
  `handleStart` → `'custom'`. Restored games read it from the savegame.
- `solveRecorded` — whether the current instance has been counted. Restored from
  the savegame's `recorded`; otherwise `false`.
- `toasts` — a queue of messages to display (managed by the Toast component or a
  small piece of state here).

Recording effect (watches `won`):

```
if (ready && !making && won && !solveRecorded) {
  const { stats: next, newBadges } = recordSolve(stats, { category, date: todayLocal() })
  setStats(next); saveStats(next)
  setSolveRecorded(true)
  // persist recorded:true so a reload of this finished board won't recount
  for (const badge of newBadges) pushToast(`🏅 ${badge.label}!`)
}
```

The save effect includes `category` and `recorded` (via `solveRecorded`) in the
`saveGame` payload so the flag survives reload.

Instance lifecycle for `solveRecorded`:

- **New Game** (`handleNewGame`): new puzzle → `solveRecorded = false`,
  `category = difficulty`.
- **Start** (`handleStart`, make-mode): new puzzle → `solveRecorded = false`,
  `category = 'custom'`.
- **Reset** (`handleReset`): same puzzle → `solveRecorded` unchanged. If the
  puzzle was already solved once, re-solving will not recount; if never solved,
  the first solve still counts.
- **Cancel** (`handleCancel`): runs `loadOrGenerate`, which restores/sets
  `category` and `solveRecorded` like mount.

Render: add `<Toast>` and `<StatsPanel stats={stats} />` to the component tree.

## UI Components

### `app/Toast.js` (new)

A transient, auto-dismissing message queue.

- Props: a list of toast messages (or an imperative `push` via a small queue in
  `Game`). Each toast auto-dismisses after ~4 seconds (`setTimeout`, cleared on
  unmount).
- Renders stacked messages in a fixed/anchored container; multiple badges earned
  in one solve produce multiple stacked toasts.
- Empty queue renders nothing.

### `app/StatsPanel.js` (new)

A collapsible panel on the main screen.

- Props: `stats`.
- A toggle button (default collapsed) labeled e.g. "Stats". When expanded shows:
  - **Streak:** current streak and best.
  - **Solved:** total, then the per-category breakdown (easy / medium / hard /
    custom).
  - **Badges:** a grid rendering every `BADGES` entry — earned ones highlighted,
    locked ones dimmed, each labeled with its description.
- Pure presentational; reads only from `stats`. No persistence here.

### `app/page.module.css`

Add styles for the toast container/items, the stats panel and its toggle, and
the badge grid (earned vs. locked states), reusing existing palette variables
(`--surface`, `--text`, `--muted`, `--accent-bg`, `--cell-border`, `--win`,
etc.). Must read legibly in both light and dark themes and fit the single-column
mobile layout.

## Components Touched

New:

- `app/lib/stats.js` — `defaultStats`, `BADGES`, `recordSolve`, `todayLocal`,
  `yesterday`.
- `app/lib/stats.test.js` — unit tests.
- `app/lib/statsStorage.js` — `loadStats`, `saveStats`, `clearStats`.
- `app/Toast.js` — toast queue component.
- `app/StatsPanel.js` — stats display + toggle.

Modified:

- `app/lib/storage.js` — bump to v3; add `category` + `recorded` to the payload.
- `app/Game.js` — load stats, record on the win transition, manage `category` /
  `solveRecorded` / toast queue, render `Toast` + `StatsPanel`.
- `app/page.module.css` — toast, panel, and badge-grid styles.

No changes to `reducer.js`, `solver.js`, `generator.js`, `validation.js`,
`makepuzzle.js`, `highlight.js`, `board.js`, or `theme.js`.

## Future Login Anticipation

Stats keys are global now (a single implicit local profile). Because
`recordSolve` is pure and persistence is a thin separate layer, a future login
system needs only to namespace the key (`sudoku-cloud:stats:<userId>`) or sync
the same serializable record to a server — no logic rewrite. No per-user code is
built today (YAGNI). The aggregate record can later be reconstructed from, or
migrated to, a server-side event log if richer history is wanted.

## Testing Strategy

TDD, Vitest, colocated `*.test.js`.

**`stats.js`:**

- `defaultStats()` returns the documented shape with zeroed counts, empty
  badges, null dates.
- `recordSolve` increments `total` and the named `category`; does not mutate the
  input object.
- Streak: first-ever solve → `current = 1`, `best = 1`; a second solve the same
  `date` → streak unchanged, `total` and `daily.count` still increment; a solve
  on `yesterday(date)+1` (consecutive) → `current + 1`; a solve after a gap →
  `current = 1`; `best` reflects the max across a sequence.
- Daily: same-day solves accumulate `daily.count`; a new day resets it to 1.
- Badges: crossing a total threshold returns it in `newBadges` exactly once and
  never again; crossing a day threshold likewise; a single solve can return
  multiple badges (e.g. first solve that hits both a total and day threshold);
  already-earned badges are never re-returned.
- `yesterday('2026-03-01')` → `'2026-02-28'`; `yesterday('2026-01-01')` →
  `'2025-12-31'` (no timezone drift); `todayLocal()` matches
  `/^\d{4}-\d{2}-\d{2}$/`.

**`statsStorage.js`** (covered via stats integration / manual): `loadStats`
returns `defaultStats()` when the key is absent or corrupt; round-trips a saved
record; `clearStats` removes it.

**UI** — verified via `npm run build` and manual play:

- Solving a generated puzzle increments the right category and total; the panel
  reflects it; reloading the finished board does not double-count.
- A streak builds across simulated days and resets after a gap.
- Crossing a milestone fires a toast that auto-dismisses; the badge then shows
  earned in the panel.
- Reset-then-resolve of an already-solved puzzle does not increment counts.
- Panel toggles open/closed; legible in light and dark themes on mobile.

## Out of Scope

- Login / accounts / multi-user profiles (future; this design only anticipates
  them).
- Server sync and event-log history.
- Timers, hints, per-puzzle solve-time records, leaderboards.
- Editing or resetting stats from the UI (no "clear stats" button this cycle).
