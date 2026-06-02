# User Authentication & Cross-Device Sync Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a player sign in with email + password and have their savegame, streak, stats, and badges sync across devices via Supabase, while guest (no-account) play keeps working exactly as today.

**Architecture:** The app stays a static client. A Supabase-hosted Postgres table (`game_state`, one row per user, RLS-protected) holds two JSON blobs (`savegame`, `stats`). New `app/lib/` modules add the Supabase client, an auth wrapper, pure merge functions, and a sync engine (pull → merge → push) layered *above* the existing offline-first `localStorage` cache, which is unchanged. Conflict rule: stats merge (max counts, union badges, max streak), newest board wins.

**Tech Stack:** Next.js 16 / React 19, `@supabase/supabase-js`, Vitest (Node env, in-memory `localStorage` mock), CSS Modules.

**Spec:** `docs/superpowers/specs/2026-06-02-user-auth-sync-design.md`

**Conventions for new `app/lib/` files:** single quotes, no semicolons, ESM — matching `app/lib/stats.js` and `app/lib/statsStorage.js`. Tests mirror `app/lib/statsStorage.test.js` (Vitest `describe/it/expect`, the `mockLocalStorage()` helper).

---

## Task 1: Add Supabase client dependency and configuration scaffolding

**Files:**
- Modify: `package.json` (dependencies)
- Create: `.env.example`
- Create: `supabase/migrations/0001_game_state.sql`

- [ ] **Step 1: Install the Supabase JS client**

Run:
```bash
npm install @supabase/supabase-js
```
Expected: `package.json` gains `@supabase/supabase-js` under `dependencies`; `package-lock.json` updates; no errors.

- [ ] **Step 2: Create `.env.example` documenting the public client vars**

Create `.env.example`:
```bash
# Supabase project credentials. Both are PUBLIC-safe to ship in the client —
# security is enforced by row-level security on the database, not key secrecy.
# Copy to .env.local and fill in from your Supabase project's API settings.
# NEVER put the service_role key here or anywhere in client code.
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
```

- [ ] **Step 3: Create the database migration (schema + RLS)**

Create `supabase/migrations/0001_game_state.sql`:
```sql
-- One row per user. savegame/stats mirror the localStorage payloads.
create table if not exists game_state (
  user_id             uuid primary key references auth.users(id) on delete cascade,
  savegame            jsonb,
  stats               jsonb,
  savegame_updated_at timestamptz,
  updated_at          timestamptz default now()
);

alter table game_state enable row level security;

-- A user may only ever touch their own row. This is the security boundary.
create policy "own row select" on game_state
  for select using (user_id = auth.uid());
create policy "own row insert" on game_state
  for insert with check (user_id = auth.uid());
create policy "own row update" on game_state
  for update using (user_id = auth.uid());
```

- [ ] **Step 4: Verify the project still builds and lints**

Run:
```bash
npm run lint && npm run build
```
Expected: lint passes; build succeeds (the new dependency is not imported yet, so nothing changes at runtime).

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json .env.example supabase/migrations/0001_game_state.sql
git commit -m "Add Supabase client dependency and game_state migration"
```

---

## Task 2: Add a `savedAt` timestamp to the local savegame

The "newest board wins" rule needs to know when each side was last saved. Add a
millisecond timestamp to the savegame payload. This is read defensively
(`?? 0`), matching how `loadGame` already defaults `category`/`recorded`, so it
does **not** require a `STORAGE_VERSION` bump and old saves still load.

**Files:**
- Modify: `app/lib/storage.js`
- Test: `app/lib/storage.test.js`

- [ ] **Step 1: Write the failing tests**

Add to `app/lib/storage.test.js` (inside the existing top-level `describe`, or a new one):
```js
it('stamps savedAt when saving and returns it on load', () => {
  saveGame({ board: [], solution: [], difficulty: 'easy', category: 'easy', recorded: false })
  const loaded = loadGame()
  expect(typeof loaded.savedAt).toBe('number')
  expect(loaded.savedAt).toBeGreaterThan(0)
})

it('defaults savedAt to 0 for a legacy save written without it', () => {
  localStorage.setItem(
    'sudoku-cloud:savegame',
    JSON.stringify({ version: STORAGE_VERSION, board: [], solution: [], difficulty: 'easy' })
  )
  expect(loadGame().savedAt).toBe(0)
})
```
Ensure the test file imports `STORAGE_VERSION`:
```js
import { saveGame, loadGame, clearGame, STORAGE_VERSION } from './storage'
```
(Adjust the existing import line if `STORAGE_VERSION` is not already imported.)

- [ ] **Step 2: Run the tests to verify they fail**

Run:
```bash
npx vitest run app/lib/storage.test.js
```
Expected: FAIL — `loaded.savedAt` is `undefined` (not a number).

- [ ] **Step 3: Add `savedAt` to save and load**

In `app/lib/storage.js`, in `saveGame`, add `savedAt` to the payload object:
```js
  const payload = JSON.stringify({
    version: STORAGE_VERSION,
    board,
    solution,
    difficulty,
    category,
    recorded,
    savedAt: Date.now(),
  });
```
In `loadGame`, add `savedAt` to the returned object:
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

- [ ] **Step 4: Run the tests to verify they pass**

Run:
```bash
npx vitest run app/lib/storage.test.js
```
Expected: PASS (all tests, including the pre-existing ones).

- [ ] **Step 5: Commit**

```bash
git add app/lib/storage.js app/lib/storage.test.js
git commit -m "Stamp savegame with savedAt for newest-wins sync"
```

---

## Task 3: Pure stats merge (`mergeStats`)

The load-bearing function. Build it test-first, one behavior per step.

**Files:**
- Create: `app/lib/mergeStats.js`
- Test: `app/lib/mergeStats.test.js`

- [ ] **Step 1: Write the failing tests (all behaviors)**

Create `app/lib/mergeStats.test.js`:
```js
import { describe, it, expect } from 'vitest'
import { mergeStats } from './mergeStats'
import { defaultStats } from './stats'

// A fully-populated stats object for a given shape.
function stats(overrides = {}) {
  return {
    version: 1,
    solved: { total: 0, easy: 0, medium: 0, hard: 0, custom: 0 },
    streak: { current: 0, best: 0, lastSolveDate: null },
    daily: { date: null, count: 0 },
    badges: [],
    ...overrides,
  }
}

describe('mergeStats', () => {
  it('returns the populated side when the other is null/empty', () => {
    const a = stats({ solved: { total: 3, easy: 3, medium: 0, hard: 0, custom: 0 } })
    expect(mergeStats(a, null)).toEqual(a)
    expect(mergeStats(null, a)).toEqual(a)
  })

  it('does not blend across version mismatches; keeps the higher version', () => {
    const v1 = stats({ version: 1 })
    const v2 = stats({ version: 2 })
    expect(mergeStats(v1, v2)).toBe(v2)
    expect(mergeStats(v2, v1)).toBe(v2)
  })

  it('takes the max of each solved category and derives total from them', () => {
    const a = stats({ solved: { total: 5, easy: 5, medium: 0, hard: 0, custom: 0 } })
    const b = stats({ solved: { total: 4, easy: 1, medium: 3, hard: 0, custom: 0 } })
    const m = mergeStats(a, b)
    expect(m.solved).toEqual({ total: 8, easy: 5, medium: 3, hard: 0, custom: 0 })
  })

  it('uses the later lastSolveDate for current streak and maxes best', () => {
    const a = stats({ streak: { current: 2, best: 9, lastSolveDate: '2026-06-01' } })
    const b = stats({ streak: { current: 5, best: 5, lastSolveDate: '2026-06-02' } })
    const m = mergeStats(a, b)
    expect(m.streak).toEqual({ current: 5, best: 9, lastSolveDate: '2026-06-02' })
  })

  it('on an equal streak date, takes the max current', () => {
    const a = stats({ streak: { current: 2, best: 2, lastSolveDate: '2026-06-02' } })
    const b = stats({ streak: { current: 4, best: 4, lastSolveDate: '2026-06-02' } })
    expect(mergeStats(a, b).streak.current).toBe(4)
  })

  it('takes the later daily date; same date maxes the count', () => {
    const older = stats({ daily: { date: '2026-06-01', count: 8 } })
    const newer = stats({ daily: { date: '2026-06-02', count: 1 } })
    expect(mergeStats(older, newer).daily).toEqual({ date: '2026-06-02', count: 1 })

    const sameA = stats({ daily: { date: '2026-06-02', count: 2 } })
    const sameB = stats({ daily: { date: '2026-06-02', count: 5 } })
    expect(mergeStats(sameA, sameB).daily).toEqual({ date: '2026-06-02', count: 5 })
  })

  it('unions badges and re-derives any threshold the merge crosses', () => {
    // a has 6 easy, b has 5 medium → merged total 11 crosses the solve-10 badge.
    const a = stats({ solved: { total: 6, easy: 6, medium: 0, hard: 0, custom: 0 }, badges: [] })
    const b = stats({ solved: { total: 5, easy: 0, medium: 5, hard: 0, custom: 0 }, badges: [] })
    expect(mergeStats(a, b).badges).toContain('solve-10')
  })

  it('preserves already-earned badges from both sides', () => {
    const a = stats({ badges: ['solve-10'] })
    const b = stats({ badges: ['day-2'] })
    const m = mergeStats(a, b)
    expect(m.badges).toEqual(expect.arrayContaining(['solve-10', 'day-2']))
  })

  it('is commutative', () => {
    const a = stats({
      solved: { total: 7, easy: 4, medium: 3, hard: 0, custom: 0 },
      streak: { current: 3, best: 6, lastSolveDate: '2026-06-01' },
      daily: { date: '2026-06-01', count: 3 },
      badges: ['solve-10'],
    })
    const b = stats({
      solved: { total: 9, easy: 2, medium: 1, hard: 5, custom: 1 },
      streak: { current: 5, best: 5, lastSolveDate: '2026-06-02' },
      daily: { date: '2026-06-02', count: 2 },
      badges: ['day-2'],
    })
    expect(mergeStats(a, b)).toEqual(mergeStats(b, a))
  })

  it('is idempotent on a self-consistent record', () => {
    const a = stats({
      solved: { total: 6, easy: 6, medium: 0, hard: 0, custom: 0 },
      badges: [],
    })
    expect(mergeStats(a, a)).toEqual(a)
  })

  it('never decreases a count or drops a badge (monotonic)', () => {
    const a = stats({
      solved: { total: 10, easy: 10, medium: 0, hard: 0, custom: 0 },
      badges: ['solve-10'],
    })
    const b = stats({ solved: { total: 1, easy: 1, medium: 0, hard: 0, custom: 0 } })
    const m = mergeStats(a, b)
    expect(m.solved.total).toBeGreaterThanOrEqual(a.solved.total)
    expect(m.badges).toContain('solve-10')
  })

  it('produces a valid default-shaped record when merging two defaults', () => {
    expect(mergeStats(defaultStats(), defaultStats())).toEqual(defaultStats())
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run:
```bash
npx vitest run app/lib/mergeStats.test.js
```
Expected: FAIL — `mergeStats` is not defined (cannot find module).

- [ ] **Step 3: Implement `mergeStats`**

Create `app/lib/mergeStats.js`:
```js
import { BADGES } from './stats'

// Merge two stats records non-destructively. The conflict rule: max each
// solved category (total derived from them), union + re-derive badges, take the
// later-dated streak/daily. Pure: no I/O, no clock. Commutative, idempotent,
// and monotonic on cumulative fields by construction.
export function mergeStats(a, b) {
  if (!a) return b
  if (!b) return a
  // Never blend mismatched shapes — return the higher-version object untouched.
  if (a.version !== b.version) return a.version > b.version ? a : b

  const solved = {
    easy: Math.max(a.solved.easy, b.solved.easy),
    medium: Math.max(a.solved.medium, b.solved.medium),
    hard: Math.max(a.solved.hard, b.solved.hard),
    custom: Math.max(a.solved.custom, b.solved.custom),
  }
  solved.total = solved.easy + solved.medium + solved.hard + solved.custom

  const streak = mergeStreak(a.streak, b.streak)
  const daily = mergeDaily(a.daily, b.daily)
  const badges = mergeBadges(a.badges, b.badges, solved.total, daily.count)

  return { version: a.version, solved, streak, daily, badges }
}

// Later lastSolveDate is authoritative for `current`; equal dates take the max
// current. `best` is the max across both plus the chosen current. Null dates
// sort earliest.
function mergeStreak(a, b) {
  const ad = a.lastSolveDate ?? ''
  const bd = b.lastSolveDate ?? ''
  let current
  let lastSolveDate
  if (ad === bd) {
    current = Math.max(a.current, b.current)
    lastSolveDate = a.lastSolveDate
  } else if (ad > bd) {
    current = a.current
    lastSolveDate = a.lastSolveDate
  } else {
    current = b.current
    lastSolveDate = b.lastSolveDate
  }
  return { current, best: Math.max(a.best, b.best, current), lastSolveDate }
}

// Daily count belongs to a calendar day: later date wins; equal date maxes.
function mergeDaily(a, b) {
  const ad = a.date ?? ''
  const bd = b.date ?? ''
  if (ad === bd) return { date: a.date, count: Math.max(a.count, b.count) }
  return ad > bd ? { ...a } : { ...b }
}

// Union of earned badges, plus any badge whose threshold the merged totals now
// cross. Output follows BADGES order for deterministic, stable results.
function mergeBadges(a, b, total, dailyCount) {
  const earned = new Set([...a, ...b])
  for (const badge of BADGES) {
    if (earned.has(badge.id)) continue
    const met =
      badge.kind === 'total' ? badge.threshold <= total : badge.threshold <= dailyCount
    if (met) earned.add(badge.id)
  }
  return BADGES.filter((badge) => earned.has(badge.id)).map((badge) => badge.id)
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run:
```bash
npx vitest run app/lib/mergeStats.test.js
```
Expected: PASS — all behaviors green.

- [ ] **Step 5: Commit**

```bash
git add app/lib/mergeStats.js app/lib/mergeStats.test.js
git commit -m "Add pure mergeStats with non-destructive conflict rule"
```

---

## Task 4: Pure savegame merge (`mergeSavegame`)

**Files:**
- Create: `app/lib/mergeSavegame.js`
- Test: `app/lib/mergeSavegame.test.js`

- [ ] **Step 1: Write the failing tests**

Create `app/lib/mergeSavegame.test.js`:
```js
import { describe, it, expect } from 'vitest'
import { mergeSavegame } from './mergeSavegame'

describe('mergeSavegame', () => {
  it('returns the only non-null side', () => {
    const g = { board: [1], savedAt: 5 }
    expect(mergeSavegame(g, null)).toBe(g)
    expect(mergeSavegame(null, g)).toBe(g)
    expect(mergeSavegame(null, null)).toBe(null)
  })

  it('keeps the more recently saved board', () => {
    const older = { board: ['old'], savedAt: 100 }
    const newer = { board: ['new'], savedAt: 200 }
    expect(mergeSavegame(older, newer)).toBe(newer)
    expect(mergeSavegame(newer, older)).toBe(newer)
  })

  it('treats a missing savedAt as oldest', () => {
    const legacy = { board: ['legacy'] }
    const stamped = { board: ['stamped'], savedAt: 1 }
    expect(mergeSavegame(legacy, stamped)).toBe(stamped)
  })

  it('keeps the first argument on an exact tie', () => {
    const a = { board: ['a'], savedAt: 50 }
    const b = { board: ['b'], savedAt: 50 }
    expect(mergeSavegame(a, b)).toBe(a)
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run:
```bash
npx vitest run app/lib/mergeSavegame.test.js
```
Expected: FAIL — cannot find module `./mergeSavegame`.

- [ ] **Step 3: Implement `mergeSavegame`**

Create `app/lib/mergeSavegame.js`:
```js
// The savegame is a single in-progress snapshot, so the most recently saved
// side wins. A missing savedAt sorts oldest; a null savegame loses to any save.
export function mergeSavegame(a, b) {
  if (!a) return b
  if (!b) return a
  return (b.savedAt ?? 0) > (a.savedAt ?? 0) ? b : a
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run:
```bash
npx vitest run app/lib/mergeSavegame.test.js
```
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add app/lib/mergeSavegame.js app/lib/mergeSavegame.test.js
git commit -m "Add pure mergeSavegame (newest board wins)"
```

---

## Task 5: Sync engine (`sync.js`)

Pull the remote row, merge with local, push the result back. Functions take an
injected client + userId so they test against a fake without network.

**Files:**
- Create: `app/lib/sync.js`
- Test: `app/lib/sync.test.js`

- [ ] **Step 1: Write the failing tests**

Create `app/lib/sync.test.js`:
```js
import { describe, it, expect } from 'vitest'
import { pullRemote, pushRemote, syncState } from './sync'

// Minimal fake of the subset of the Supabase client these functions use:
//   client.from('game_state').select(...).eq(...).maybeSingle()  -> { data, error }
//   client.from('game_state').upsert(row)                        -> { error }
function fakeClient(initialRow = null) {
  const state = { row: initialRow, upserts: [] }
  const builder = {
    select: () => builder,
    eq: () => builder,
    maybeSingle: async () => ({ data: state.row, error: null }),
    upsert: async (row) => {
      state.upserts.push(row)
      state.row = row
      return { error: null }
    },
  }
  return { client: { from: () => builder }, state }
}

const USER = 'user-123'

describe('sync', () => {
  it('pullRemote returns the row (or null when none)', async () => {
    const empty = fakeClient(null)
    expect(await pullRemote(empty.client, USER)).toBe(null)

    const row = { savegame: { savedAt: 1 }, stats: { version: 1 } }
    const present = fakeClient(row)
    expect(await pullRemote(present.client, USER)).toEqual(row)
  })

  it('pullRemote throws on a client error', async () => {
    const errClient = {
      from: () => ({
        select: () => errClient.from(),
        eq: () => errClient.from(),
        maybeSingle: async () => ({ data: null, error: new Error('boom') }),
      }),
    }
    await expect(pullRemote(errClient, USER)).rejects.toThrow('boom')
  })

  it('pushRemote upserts the user row with derived timestamps', async () => {
    const { client, state } = fakeClient(null)
    await pushRemote(client, USER, { savegame: { savedAt: 1717286400000 }, stats: { version: 1 } })
    expect(state.upserts).toHaveLength(1)
    const row = state.upserts[0]
    expect(row.user_id).toBe(USER)
    expect(row.stats).toEqual({ version: 1 })
    expect(row.savegame_updated_at).toBe(new Date(1717286400000).toISOString())
  })

  it('syncState merges local into an empty remote and pushes the result', async () => {
    const { client, state } = fakeClient(null)
    const local = {
      savegame: { board: ['local'], savedAt: 500 },
      stats: { version: 1, solved: { total: 3, easy: 3, medium: 0, hard: 0, custom: 0 }, streak: { current: 0, best: 0, lastSolveDate: null }, daily: { date: null, count: 0 }, badges: [] },
    }
    const merged = await syncState(client, USER, local)
    expect(merged.savegame.board).toEqual(['local'])
    expect(merged.stats.solved.total).toBe(3)
    expect(state.upserts).toHaveLength(1)
  })

  it('syncState keeps the newer remote board but merges stats counts', async () => {
    const remoteRow = {
      savegame: { board: ['remote'], savedAt: 900 },
      stats: { version: 1, solved: { total: 2, easy: 0, medium: 2, hard: 0, custom: 0 }, streak: { current: 0, best: 0, lastSolveDate: null }, daily: { date: null, count: 0 }, badges: [] },
    }
    const { client } = fakeClient(remoteRow)
    const local = {
      savegame: { board: ['local'], savedAt: 500 },
      stats: { version: 1, solved: { total: 3, easy: 3, medium: 0, hard: 0, custom: 0 }, streak: { current: 0, best: 0, lastSolveDate: null }, daily: { date: null, count: 0 }, badges: [] },
    }
    const merged = await syncState(client, USER, local)
    expect(merged.savegame.board).toEqual(['remote']) // newer savedAt wins
    expect(merged.stats.solved).toEqual({ total: 5, easy: 3, medium: 2, hard: 0, custom: 0 })
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run:
```bash
npx vitest run app/lib/sync.test.js
```
Expected: FAIL — cannot find module `./sync`.

- [ ] **Step 3: Implement `sync.js`**

Create `app/lib/sync.js`:
```js
import { mergeStats } from './mergeStats'
import { mergeSavegame } from './mergeSavegame'

const TABLE = 'game_state'

// Read the caller's row. Returns null when no row exists yet.
export async function pullRemote(client, userId) {
  const { data, error } = await client
    .from(TABLE)
    .select('savegame, stats')
    .eq('user_id', userId)
    .maybeSingle()
  if (error) throw error
  return data ?? null
}

// Upsert the caller's row. savegame_updated_at mirrors the savegame's savedAt
// for observability; the merge itself reads the embedded savedAt.
export async function pushRemote(client, userId, { savegame, stats }) {
  const { error } = await client.from(TABLE).upsert({
    user_id: userId,
    savegame,
    stats,
    savegame_updated_at: savegame?.savedAt ? new Date(savegame.savedAt).toISOString() : null,
    updated_at: new Date().toISOString(),
  })
  if (error) throw error
}

// Pull remote, merge with local, push the merged result, and return it so the
// caller can update the local cache and UI. Used on sign-in and app load.
export async function syncState(client, userId, local) {
  const remote = await pullRemote(client, userId)
  const merged = {
    savegame: mergeSavegame(local.savegame ?? null, remote?.savegame ?? null),
    stats: mergeStats(local.stats ?? null, remote?.stats ?? null),
  }
  await pushRemote(client, userId, merged)
  return merged
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run:
```bash
npx vitest run app/lib/sync.test.js
```
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add app/lib/sync.js app/lib/sync.test.js
git commit -m "Add sync engine: pull, merge, push against injected client"
```

---

## Task 6: Supabase client factory (`supabase.js`)

**Files:**
- Create: `app/lib/supabase.js`
- Test: `app/lib/supabase.test.js`

- [ ] **Step 1: Write the failing tests**

Create `app/lib/supabase.test.js`:
```js
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { getSupabase, __resetSupabaseForTests } from './supabase'

describe('getSupabase', () => {
  const saved = {}
  beforeEach(() => {
    saved.url = process.env.NEXT_PUBLIC_SUPABASE_URL
    saved.key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    __resetSupabaseForTests()
  })
  afterEach(() => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = saved.url
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = saved.key
    __resetSupabaseForTests()
  })

  it('returns null when the env vars are not configured', () => {
    delete process.env.NEXT_PUBLIC_SUPABASE_URL
    delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    expect(getSupabase()).toBe(null)
  })

  it('returns a client (with an auth namespace) when configured', () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co'
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'anon-key'
    const client = getSupabase()
    expect(client).not.toBe(null)
    expect(client.auth).toBeDefined()
  })

  it('memoizes the client across calls', () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co'
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'anon-key'
    expect(getSupabase()).toBe(getSupabase())
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run:
```bash
npx vitest run app/lib/supabase.test.js
```
Expected: FAIL — cannot find module `./supabase`.

- [ ] **Step 3: Implement `supabase.js`**

Create `app/lib/supabase.js`:
```js
import { createClient } from '@supabase/supabase-js'

let client = null

// Lazily create a single Supabase client. Returns null when the project is not
// configured, so the app degrades to guest-only play instead of crashing.
export function getSupabase() {
  if (client) return client
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !key) return null
  client = createClient(url, key)
  return client
}

// Test-only: clear the memoized client so env changes take effect.
export function __resetSupabaseForTests() {
  client = null
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run:
```bash
npx vitest run app/lib/supabase.test.js
```
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add app/lib/supabase.js app/lib/supabase.test.js
git commit -m "Add lazy Supabase client factory (null when unconfigured)"
```

---

## Task 7: Auth wrapper (`auth.js`)

Thin pass-throughs over `supabase.auth`, so the rest of the app never imports
the SDK directly.

**Files:**
- Create: `app/lib/auth.js`
- Test: `app/lib/auth.test.js`

- [ ] **Step 1: Write the failing tests**

Create `app/lib/auth.test.js`:
```js
import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock the client factory so auth.js calls a fake auth namespace.
const fakeAuth = {
  signUp: vi.fn(async () => ({ data: { user: { id: 'u1' } }, error: null })),
  signInWithPassword: vi.fn(async () => ({ data: { session: {} }, error: null })),
  signOut: vi.fn(async () => ({ error: null })),
  getSession: vi.fn(async () => ({ data: { session: null } })),
  onAuthStateChange: vi.fn(() => ({ data: { subscription: { unsubscribe: vi.fn() } } })),
}
vi.mock('./supabase', () => ({ getSupabase: () => ({ auth: fakeAuth }) }))

const { signUp, signIn, signOut, getSession, onAuthStateChange } = await import('./auth')

beforeEach(() => {
  Object.values(fakeAuth).forEach((fn) => fn.mockClear?.())
})

describe('auth wrapper', () => {
  it('signUp forwards email and password', async () => {
    await signUp('a@b.com', 'pw')
    expect(fakeAuth.signUp).toHaveBeenCalledWith({ email: 'a@b.com', password: 'pw' })
  })
  it('signIn calls signInWithPassword', async () => {
    await signIn('a@b.com', 'pw')
    expect(fakeAuth.signInWithPassword).toHaveBeenCalledWith({ email: 'a@b.com', password: 'pw' })
  })
  it('signOut calls through', async () => {
    await signOut()
    expect(fakeAuth.signOut).toHaveBeenCalled()
  })
  it('onAuthStateChange registers a callback', () => {
    const cb = () => {}
    onAuthStateChange(cb)
    expect(fakeAuth.onAuthStateChange).toHaveBeenCalledWith(cb)
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run:
```bash
npx vitest run app/lib/auth.test.js
```
Expected: FAIL — cannot find module `./auth`.

- [ ] **Step 3: Implement `auth.js`**

Create `app/lib/auth.js`:
```js
import { getSupabase } from './supabase'

// All auth flows funnel through here so components never touch the SDK.
// Each returns the raw Supabase result ({ data, error }); callers surface
// error.message inline.
export async function signUp(email, password) {
  return getSupabase().auth.signUp({ email, password })
}

export async function signIn(email, password) {
  return getSupabase().auth.signInWithPassword({ email, password })
}

export async function signOut() {
  return getSupabase().auth.signOut()
}

export async function getSession() {
  return getSupabase().auth.getSession()
}

// Subscribe to sign-in/out. Returns { data: { subscription } } — call
// subscription.unsubscribe() to clean up.
export function onAuthStateChange(callback) {
  return getSupabase().auth.onAuthStateChange(callback)
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run:
```bash
npx vitest run app/lib/auth.test.js
```
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add app/lib/auth.js app/lib/auth.test.js
git commit -m "Add auth wrapper over supabase.auth"
```

---

## Task 8: Auth context provider (`AuthProvider`)

Holds the session, exposes auth actions to the tree, and unsubscribes on
unmount. No new vitest tests (the repo tests logic, not React components — there
is no React Testing Library installed); verified via build + manual smoke test
in the integration task.

**Files:**
- Create: `app/AuthProvider.js`
- Modify: `app/layout.js` (wrap children)

- [ ] **Step 1: Create the provider**

Create `app/AuthProvider.js`:
```js
'use client'
import { createContext, useContext, useEffect, useState } from 'react'
import { getSupabase } from './lib/supabase'
import { getSession, onAuthStateChange, signIn, signUp, signOut } from './lib/auth'

const AuthContext = createContext(null)

export function useAuth() {
  return useContext(AuthContext)
}

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null)
  const [ready, setReady] = useState(false)
  const configured = getSupabase() != null

  useEffect(() => {
    if (!configured) {
      setReady(true)
      return
    }
    getSession().then(({ data }) => {
      setSession(data.session ?? null)
      setReady(true)
    })
    const { data } = onAuthStateChange((_event, nextSession) => {
      setSession(nextSession ?? null)
    })
    return () => data.subscription.unsubscribe()
  }, [configured])

  const value = {
    configured,
    ready,
    session,
    user: session?.user ?? null,
    signIn,
    signUp,
    signOut,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
```

- [ ] **Step 2: Wrap the app in the provider**

In `app/layout.js`, import the provider and wrap the rendered children. Add near the other imports:
```js
import { AuthProvider } from './AuthProvider'
```
Then wrap whatever `layout.js` renders inside `<body>` with `<AuthProvider>...</AuthProvider>`. For example, if the body renders `{children}`, change it to:
```js
        <AuthProvider>{children}</AuthProvider>
```
(Leave the existing inline theme script and `<body>` attributes untouched — only wrap the children.)

- [ ] **Step 3: Verify build and lint**

Run:
```bash
npm run lint && npm run build
```
Expected: passes. (The provider renders children unchanged; with no env vars it stays in guest mode.)

- [ ] **Step 4: Commit**

```bash
git add app/AuthProvider.js app/layout.js
git commit -m "Add AuthProvider context and wrap the app"
```

---

## Task 9: Account menu + auth form UI

A header control: signed out shows "Sign in" opening a form (toggle sign-up /
sign-in, plus forgot-password); signed in shows the email, a sync-status dot,
and "Sign out". Renders nothing when Supabase is unconfigured (pure guest mode).

**Files:**
- Create: `app/AccountMenu.js`
- Create: `app/AccountMenu.module.css`

- [ ] **Step 1: Create the account menu component**

Create `app/AccountMenu.js`:
```js
'use client'
import { useState } from 'react'
import { useAuth } from './AuthProvider'
import styles from './AccountMenu.module.css'

// `syncStatus` is one of 'synced' | 'syncing' | 'offline' | null, passed down
// from Game once sync is wired in (Task 10).
export default function AccountMenu({ syncStatus = null }) {
  const auth = useAuth()
  const [open, setOpen] = useState(false)
  const [mode, setMode] = useState('signin') // 'signin' | 'signup'
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [message, setMessage] = useState(null)
  const [busy, setBusy] = useState(false)

  if (!auth || !auth.configured) return null
  if (!auth.ready) return null

  async function handleSubmit(e) {
    e.preventDefault()
    setBusy(true)
    setMessage(null)
    const action = mode === 'signup' ? auth.signUp : auth.signIn
    const { error } = await action(email, password)
    setBusy(false)
    if (error) {
      setMessage(error.message)
      return
    }
    if (mode === 'signup') {
      setMessage('Check your email to confirm your account.')
    } else {
      setOpen(false)
      setEmail('')
      setPassword('')
    }
  }

  if (auth.user) {
    return (
      <div className={styles.account}>
        <span className={`${styles.dot} ${styles[syncStatus] ?? ''}`} title={syncStatus ?? ''} />
        <span className={styles.email}>{auth.user.email}</span>
        <button className={styles.link} onClick={() => auth.signOut()}>
          Sign out
        </button>
      </div>
    )
  }

  return (
    <div className={styles.account}>
      {!open && (
        <button className={styles.link} onClick={() => setOpen(true)}>
          Sign in to sync
        </button>
      )}
      {open && (
        <form className={styles.form} onSubmit={handleSubmit}>
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={6}
          />
          <button type="submit" disabled={busy}>
            {mode === 'signup' ? 'Sign up' : 'Sign in'}
          </button>
          <button
            type="button"
            className={styles.link}
            onClick={() => setMode(mode === 'signup' ? 'signin' : 'signup')}
          >
            {mode === 'signup' ? 'Have an account? Sign in' : 'New? Create an account'}
          </button>
          {message && <p className={styles.message}>{message}</p>}
        </form>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Create the styles**

Create `app/AccountMenu.module.css`:
```css
.account {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex-wrap: wrap;
  justify-content: center;
  font-size: 0.85rem;
}

.email {
  opacity: 0.8;
}

.link {
  background: none;
  border: none;
  color: inherit;
  text-decoration: underline;
  cursor: pointer;
  font-size: inherit;
  padding: 0;
}

.form {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.4rem;
}

.form input {
  padding: 0.3rem 0.5rem;
  font-size: 0.85rem;
}

.message {
  width: 100%;
  margin: 0.2rem 0 0;
  opacity: 0.8;
}

.dot {
  width: 0.6rem;
  height: 0.6rem;
  border-radius: 50%;
  background: #bbb;
}

.dot.synced {
  background: #4caf50;
}

.dot.syncing {
  background: #ffc107;
}

.dot.offline {
  background: #e57373;
}
```

- [ ] **Step 3: Verify build and lint**

Run:
```bash
npm run lint && npm run build
```
Expected: passes. (Component is not mounted yet.)

- [ ] **Step 4: Commit**

```bash
git add app/AccountMenu.js app/AccountMenu.module.css
git commit -m "Add account menu + email/password auth form"
```

---

## Task 10: Wire sync into the game

Mount the account menu, and on sign-in (or app load with a session) pull → merge
→ push, then apply the merged result to local cache and live UI. While signed in
and online, debounce a push after local changes. Track `syncStatus`.

**Files:**
- Modify: `app/Game.js`

- [ ] **Step 1: Add imports and the auth hook**

In `app/Game.js`, add to the imports:
```js
import AccountMenu from './AccountMenu'
import { useAuth } from './AuthProvider'
import { getSupabase } from './lib/supabase'
import { syncState, pushRemote } from './lib/sync'
import { clearGame } from './lib/storage'
```
Note: `loadGame`, `saveGame`, `loadStats`, `saveStats` are already imported — keep those lines. Inside the `Game()` component body, near the other hooks, add:
```js
  const auth = useAuth()
  const [syncStatus, setSyncStatus] = useState(null)
```

- [ ] **Step 2: Sync on sign-in / session-present**

In `app/Game.js`, after the existing "record a solve" effect, add a new effect that reacts to the signed-in user. It pulls + merges + pushes, then applies the merged result to local storage and live state:
```js
  // On sign-in (or load with an existing session): reconcile local with the
  // cloud, then adopt the merged result locally and in the UI.
  const userId = auth?.user?.id ?? null
  useEffect(() => {
    if (!ready || !userId) return
    const client = getSupabase()
    if (!client) return
    let cancelled = false
    setSyncStatus('syncing')
    syncState(client, userId, { savegame: loadGame(), stats: loadStats() })
      .then((merged) => {
        if (cancelled) return
        if (merged.stats) {
          saveStats(merged.stats)
          setStats(merged.stats)
        }
        if (merged.savegame && merged.savegame.board && merged.savegame.solution) {
          saveGame(merged.savegame)
          dispatch({ type: 'restore', board: merged.savegame.board })
          setSolution(merged.savegame.solution)
          if (merged.savegame.difficulty) setDifficulty(merged.savegame.difficulty)
          setCategory(merged.savegame.category ?? merged.savegame.difficulty ?? DEFAULT_DIFFICULTY)
          setSolveRecorded(merged.savegame.recorded ?? false)
          setGivens(merged.savegame.board.map((c) => (c.given ? c.value : 0)))
        }
        setSyncStatus('synced')
      })
      .catch(() => {
        if (!cancelled) setSyncStatus('offline')
      })
    return () => {
      cancelled = true
    }
  }, [ready, userId])
```

- [ ] **Step 3: Push local changes while signed in (debounced)**

In `app/Game.js`, add another effect that pushes the current local state to the
cloud shortly after it changes, but only when signed in and after the initial
sync. It reads the freshly written local cache so it captures the same payloads:
```js
  // Debounced push of local changes to the cloud while signed in. Skips while
  // making a puzzle (consistent with the local-save effect).
  useEffect(() => {
    if (!ready || making || !userId || syncStatus == null) return
    const client = getSupabase()
    if (!client) return
    const id = setTimeout(() => {
      pushRemote(client, userId, { savegame: loadGame(), stats: loadStats() })
        .then(() => setSyncStatus('synced'))
        .catch(() => setSyncStatus('offline'))
    }, 1500)
    return () => clearTimeout(id)
  }, [ready, making, userId, board, solution, difficulty, category, solveRecorded, stats])
```

- [ ] **Step 4: Reset local state on sign-out**

In `app/Game.js`, add an effect that clears the sync status when the user signs
out, so the status dot and push effect go idle (local play continues):
```js
  // When the user signs out, stop syncing. Local cache and play are untouched.
  useEffect(() => {
    if (!userId) setSyncStatus(null)
  }, [userId])
```

- [ ] **Step 5: Render the account menu**

In `app/Game.js`, render `<AccountMenu>` in the returned JSX, next to the theme
toggle near the top:
```js
      <ThemeToggle />
      <AccountMenu syncStatus={syncStatus} />
```
(Add the `AccountMenu` line directly after the existing `<ThemeToggle />`.)

- [ ] **Step 6: Verify existing tests, lint, and build still pass**

Run:
```bash
npx vitest run && npm run lint && npm run build
```
Expected: all existing tests PASS (no test imports `Game.js`), lint clean, build succeeds. With no Supabase env vars, `getSupabase()` returns null, `AccountMenu` renders nothing, and the game behaves exactly as before.

- [ ] **Step 7: Manual smoke test (requires a configured Supabase project)**

With `.env.local` filled in and the migration applied to your project:
1. `npm run dev`, open the app — solve a puzzle as a guest so local stats exist.
2. Click "Sign in to sync", create an account, confirm via email, sign in.
3. Confirm the status dot goes amber → green and your guest stats are preserved.
4. Open the app in a second browser, sign in — confirm stats/board appear.
5. Solve a puzzle in one, reload the other — confirm counts merged upward.

- [ ] **Step 8: Commit**

```bash
git add app/Game.js
git commit -m "Wire cloud sync into the game (pull/merge/push + status)"
```

---

## Task 11: Document setup in the README and tick the roadmap

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Add a "Cloud sync" section and update persistence notes**

In `README.md`, add a new section after the "## Persistence" section explaining
sync. Insert:
```markdown
## Cloud sync (accounts)

Optional. With no account the app is local-only, exactly as described above.
Signing in (email + password) turns on cross-device sync via Supabase:

- State lives in a single `game_state` row per user (RLS-protected) holding the
  `savegame` and `stats` blobs. Theme stays device-local.
- **Conflict rule:** the most recently saved board wins; stats merge
  non-destructively (max solved counts, union badges, later-dated streak/daily),
  so a solve is never lost.
- Setup: copy `.env.example` → `.env.local`, fill in the Supabase URL + anon
  key, and apply `supabase/migrations/0001_game_state.sql` to your project.
```

- [ ] **Step 2: Mark the roadmap item**

In `README.md`, under "### Phase 5 — Progress & stats", the line
`- [x] localStorage-backed, structured for a future per-user login` already
notes the intent. Add a new completed Phase below Phase 5 (before
"### Future — Native iOS app (maybe)"):
```markdown
### Phase 6 — Accounts & cross-device sync ✅

- [x] Email + password auth (Supabase), guest play still default
- [x] Per-user cloud state with row-level security
- [x] Non-destructive stats merge + newest-board-wins conflict resolution
- [x] Offline-first: local cache unchanged, syncs on reconnect
```

- [ ] **Step 3: Verify the docs render and nothing else broke**

Run:
```bash
npm run lint
```
Expected: passes (lint ignores Markdown, but confirms no accidental code edits).

- [ ] **Step 4: Commit**

```bash
git add README.md
git commit -m "Document cloud sync setup and mark Phase 6 complete"
```

---

## Final verification

- [ ] Run the full suite and production build:
```bash
npx vitest run && npm run lint && npm run build
```
Expected: all tests pass, lint clean, build succeeds.

- [ ] Confirm guest mode is untouched: with no `.env.local`, the app plays
exactly as before and `AccountMenu` renders nothing.
