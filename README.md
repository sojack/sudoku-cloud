# Sudoku Cloud

A personal Sudoku web app built with Next.js + React. The goal is a polished,
self-use Sudoku game: play, generate, and create puzzles, with progress saved
across sessions.

## Stack

- Next.js 16 (App Router) + React 19
- CSS Modules

## Running

```bash
npm install
npm run dev      # http://localhost:3000
npm run build    # production build
```

## Persistence

All state is client-side `localStorage` — device- and browser-scoped, not
account-scoped (no cross-device sync). Three independent keys:

| Key | Holds |
|-----|-------|
| `sudoku-cloud:savegame` | Current board, solution, difficulty/category, `recorded` flag. Versioned via `STORAGE_VERSION`; a version mismatch silently discards the old save. |
| `sudoku-cloud:stats` | Streak, per-difficulty solved counts, earned badges. |
| `sudoku-cloud:theme` | Light/dark choice (read inline in `layout.js` before paint to avoid a flash). |

Durability:

- **Survives:** refresh, tab close, browser restart, OS reboot.
- **Does not survive / share across:** a different browser or device,
  incognito sessions, clearing site data, or a different origin.
- **Eviction risk:** Safari's ITP can purge script-writable storage after
  ~7 days of no interaction, so a returning user may lose their streak/stats.

**Gotcha:** the stats key is *not* schema-versioned the way `savegame` is.
Add versioning to `statsStorage.js` before changing the stats object shape,
or old stored objects will be read as-is instead of invalidated.

True cross-device durability and eviction resistance is the future
login/user-system path the code is already shaped for (the `recorded` flag and
per-category counts migrate cleanly to a backend).

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

## Roadmap

The path from the current proof-of-concept to a finished, daily-use app.

### Phase 1 — Fix the foundation (make it a real game) ✅

- [x] Lift board state into React as a single source of truth (per-cell
      `value`, `given`); cells are controlled inputs
- [x] Replace per-keystroke solution-matching with proper Sudoku conflict
      checking (row / column / box)
- [x] Fix the progress counter to read live board state (per-digit remaining)
- [x] Add win detection (board full + no conflicts → victory state)
- [x] Remove dead code (`app/components/Cell.js`, `app/test/`, commented blocks)

### Phase 2 — Core playability ✅

- [x] Custom number-input UI (1–9 keypad) for keyboard-free / mobile play
- [x] Pencil / notes mode (candidates per cell)
- [x] New game / reset / erase controls
- [x] localStorage persistence (resume on refresh)

### Phase 3 — Puzzle variety ✅

- [x] Puzzle generator + solver with difficulty levels
- [x] "Make sudoku" mode: clear board, enter a puzzle, solve it

### Phase 4 — Polish ✅

- [x] Styling pass + dark mode + mobile layout
- [x] Highlight peers / same-numbers
- [x] ~~Timer, hint button, undo / redo~~ — intentionally dropped (not wanted)
- [x] ~~Keyboard navigation between cells~~ — intentionally dropped (not wanted)

### Phase 5 — Progress & stats ✅

- [x] Solved-puzzle counts (total + per category: easy/medium/hard/custom)
- [x] Daily streak (consecutive days with a solve)
- [x] Milestone badges (total solved + solves-in-a-day), celebrated with a toast
- [x] localStorage-backed, structured for a future per-user login

### Phase 6 — Accounts & cross-device sync ✅

- [x] Email + password auth (Supabase), guest play still default
- [x] Per-user cloud state with row-level security
- [x] Non-destructive stats merge + newest-board-wins conflict resolution
- [x] Offline-first: local cache unchanged, syncs on reconnect

### Future — Native iOS app (maybe)

Possible future feature, not committed. The app is pure client-side, so the
likely path is a [Capacitor](https://capacitorjs.com/) wrapper rather than a
React Native rewrite:

- [ ] Static export (`output: 'export'`) — no SSR/API routes today, so this
      should be clean
- [ ] Wrap with Capacitor (`@capacitor/ios`), `webDir` → `out/`; `localStorage`
      works as-is inside WKWebView
- [ ] Native polish: app icon, splash, safe-area insets, haptics on input —
      partly to avoid App Store "thin wrapper" rejection (Guideline 4.2)
- [ ] Apple Developer Program, signing, TestFlight, App Store submission

## History

Original scratch to-do (superseded by the roadmap above):

- ✅ add check / error count
- add style
- add input digits (custom ui)
- add input count (found/total)
- random sudoku
- make sudoku: clears board, allow inputs, click done to solve
