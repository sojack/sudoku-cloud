# User Authentication & Cross-Device Sync — Design

Date: 2026-06-02
Status: Approved (design); implementation plan pending.

## Goal

Let a player use one account across devices (phone + laptop) and have the
same savegame, streak, stats, and badges follow them. Authentication is the
gate; **cross-device sync is the actual goal**. This is the future
"login/user-system path" the README already anticipates.

## Decisions (locked)

- **Backend:** Supabase (managed BaaS — auth + Postgres + row-level security).
  The app stays a pure **static client**, preserving `output: 'export'` and the
  future iOS-via-Capacitor path.
- **Sign-in method:** email + password only (no OAuth for now).
- **Conflict resolution:** merge stats; newest board wins.
- **Guest play:** optional, guest-by-default. The app behaves exactly as today
  with no account; signing in turns on sync and merges local progress up.
- **Theme:** stays device-local, not synced.

## Non-goals

- OAuth / social / magic-link sign-in (revisit later; Apple sign-in will likely
  be required if/when the iOS app ships with other social logins).
- Sign in with Apple / iOS packaging (separate roadmap item).
- Multi-user-per-device profiles, sharing, or any social features.
- Server-authoritative live state (would break offline play — rejected).
- Syncing the theme preference.

## Architecture

The app remains a static client; Supabase is reached over HTTPS via
`@supabase/supabase-js`. New modules, all under `app/lib/`:

| Module | Responsibility |
|--------|----------------|
| `supabase.js` | Create the Supabase client from `NEXT_PUBLIC_SUPABASE_URL` + `NEXT_PUBLIC_SUPABASE_ANON_KEY`. |
| `auth.js` | Thin wrapper: `signUp`, `signIn`, `signOut`, `getSession`, `onAuthStateChange`. |
| `mergeStats.js` | Pure stats-merge function. No I/O. Heavily unit-tested. |
| `sync.js` | The pull → merge → push engine + offline queue. |
| `AuthProvider` (context) | Exposes `{ user, session, syncStatus, signIn, signUp, signOut }` to the React tree. |

**`storage.js` and `statsStorage.js` are unchanged.** They remain the
offline-first local cache (source of truth while offline). The sync layer sits
*above* them, so existing behavior and tests stay intact. Nothing about offline
play regresses.

### Why the anon key is safe in the client

The `anon` key is designed to ship in client code. The real security boundary
is **row-level security** on the database (below), not key secrecy. The
`service_role` key must **never** be shipped to the client.

## Data model (Supabase)

Authentication uses Supabase's built-in `auth.users` (email + password).

One table, one row per user:

```sql
create table game_state (
  user_id             uuid primary key references auth.users(id) on delete cascade,
  savegame            jsonb,        -- the storage.js payload (board, solution, etc.)
  stats               jsonb,        -- the statsStorage payload
  savegame_updated_at timestamptz,  -- drives "newest board wins"
  updated_at          timestamptz default now()
);

alter table game_state enable row level security;

-- A user can only ever read/write their own row.
create policy "own row select" on game_state for select using (user_id = auth.uid());
create policy "own row insert" on game_state for insert with check (user_id = auth.uid());
create policy "own row update" on game_state for update using (user_id = auth.uid());
```

One combined row (vs. a row per storage key) is chosen for simplicity — the
data is tiny and the merge logic is client-side regardless.

## Sync engine (`sync.js`)

**On sign-in, and on app load when a session already exists:**

1. PULL the remote `game_state` row (may be empty for a new account).
2. MERGE remote with local:
   - **Savegame:** newest wins — compare the local save timestamp against
     `savegame_updated_at`; keep the more recent board snapshot.
   - **Stats:** `mergeStats(local, remote)` (see below).
3. PUSH the merged result back to the remote row.
4. Write the merged result to the local cache.

Both sides now agree. First-login migration of existing local progress is just
this same merge with an empty remote.

**During play (signed in + online):** each local write (save game, record
solve) debounces a PUSH to the remote row.

**Offline:** the local cache is the source of truth. A `pending` flag marks
unpushed changes. On reconnect → pull → merge → push. A `syncStatus`
(`synced` | `syncing` | `offline`) is surfaced in the UI.

## `mergeStats(local, remote)` — precise rule

Operates on the real stats shape from `app/lib/stats.js`
(`{ version, solved, streak, daily, badges }`).

- **`version` mismatch:** do **not** merge. Take the higher-version side
  untouched. (This also closes the long-standing README gotcha that the stats
  key was not version-guarded across shape changes — the merge path now refuses
  to blend mismatched shapes.)
- **`solved`:** take the **max of each category** (`easy`, `medium`, `hard`,
  `custom`), then set `total = easy + medium + hard + custom` so the total stays
  self-consistent rather than being blindly maxed.
- **`streak`:** take the side with the later `lastSolveDate` as the
  authoritative `current` and `lastSolveDate`; set
  `best = max(local.best, remote.best, merged.current)`.
- **`daily`:** the later `date` wins; if the dates are equal, take the max
  `count`.
- **`badges`:** **union** of both lists, then re-derive any badge whose
  threshold the merged `solved.total` / `daily.count` now crosses.

### Required properties (tested)

- **Commutative:** `merge(a, b)` deep-equals `merge(b, a)`.
- **Idempotent:** `merge(a, a) === a` and `merge(merge(a,b), b) === merge(a,b)`.
- **Monotonic / non-destructive:** the merged result never has a smaller count
  or a dropped badge than either input → **a solve is never lost.**

### Known, accepted approximation

Merging `streak` by latest-date (rather than a full date-aware recompute across
both histories) can be optimistic by up to a day in rare cross-device-same-day
edge cases. Accepted for simplicity; documented here intentionally.

## Auth & UI

- An account control lives in the header.
  - **Signed out:** "Sign in" opens a small form that toggles between sign-up
    and sign-in, plus a "forgot password" action (Supabase reset email).
  - **Signed in:** shows the account email, the sync-status indicator, and
    "Sign out".
- **Guest by default:** no account is required; the app behaves exactly as
  today. The first sign-in merges existing local progress up into the account.
  Sign-out reverts to local-only play.
- **Email confirmation on sign-up:** recommended **on** (Supabase default).

## Error handling

- Network or auth failures never break play: fall back to the offline cache,
  show the offline/sync status, and retry on reconnect.
- Auth errors (wrong password, email already registered, weak password) render
  inline on the form.
- The merge is deterministic and non-destructive by construction (see
  properties above), so a failed/retried push cannot corrupt or shrink state.

## Testing strategy

- **`mergeStats.js`:** exhaustive pure unit tests, including the commutative /
  idempotent / monotonic properties and the version-mismatch guard. TDD.
- **`sync.js`:** tested against an **injected fake Supabase client** — verifies
  the pull → merge → push sequence, first-login migration (empty remote), and
  the offline pending-queue / reconnect path.
- **`auth.js`:** thin wrapper, tested with a mocked client.
- Existing `storage` / `statsStorage` / `stats` tests remain unchanged.

## Configuration

- `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` in
  `.env.local` (and the deployment environment). Public-safe.
- `service_role` key is never referenced in client code.
- Supabase project setup: create the `game_state` table, enable RLS, add the
  three policies, enable email/password auth, and configure the confirmation +
  password-reset email templates.
