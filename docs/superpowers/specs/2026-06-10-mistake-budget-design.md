# Mistake Budget Design

**Date:** 2026-06-10

## Goal

Close the "spam each cell until it gives the right number" exploit by giving the player a budget of three mistakes per puzzle. A wrong placement costs a strike; the third strike ends the game. This keeps the satisfying instant feedback while making brute-force guessing self-defeating.

## Background — why the exploit exists

The game gives instant, per-cell correctness feedback against the stored solution in two ways, and both act as oracles:

- **Mistake highlighting** (`findMistakes` in `app/lib/validation.js`) — any filled cell whose value differs from the solution turns red. Cycle 1–9 and the digit that *isn't* red is the answer.
- **Silent auto-lock** (`lockedCells`) — a correct entry locks and can no longer be edited. Cycle 1–9 and the digit that *sticks* is the answer.

The spam behaviour is the direct consequence of this feedback, not a separate bug. Rather than remove the feedback (the player chose to keep it), we make abusing it expensive: every wrong guess burns one of three lives.

## Decisions (settled during brainstorming)

- **Approach:** mistake budget (keep answer-key feedback; punish wrong guesses).
- **Budget:** 3 mistakes. The third strike is terminal.
- **On limit:** hard **game over** — the board freezes; the player must start a new puzzle or reset to replay.
- **Counting:** **per wrong placement**, not per wrong cell. Cycling 1→2→3 in one cell is three distinct wrong changes = three strikes. (Per-cell counting would re-open the exploit.)
- **Notes never strike.** Only placing a *value* can earn a strike.
- **Keep the silent auto-lock.** With the budget, probing for the lock now costs strikes, so it is no longer a free oracle.
- **Wrong numbers stay on the board (red)** after a strike — they are not auto-cleared. The player erases them; erasing does not refund the strike. (Matches current mistake-highlight behaviour.)
- **The counter is shown**, not hidden.

## Out of scope

- **Undo** is a separate, follow-up feature (brainstormed next). When it is designed, an undo will snapshot full game state (board **and** mistake count), so undoing an accidental wrong value also refunds the strike. This spec is built so that addition is a clean extension — `mistakeCount` is ordinary state the future undo stack will snapshot.
- No change to difficulty scaling (a flat budget of 3 across all difficulties).

## Detailed design

### 1. The strike rule (pure, unit-tested)

A pure helper in `app/lib/validation.js`:

```js
// True when placing `nextValue` in a cell is a *new wrong* value: an actual
// change away from the previous value, to something other than the solution.
// Re-placing the same wrong value, erasing, and correct placements never strike.
export function isStrike(prevValue, nextValue, solutionDigit) {
  return nextValue !== prevValue && nextValue !== solutionDigit
}
```

This is the entire anti-spam core and is tested in isolation:

- new wrong value (`prev=null, next=5, sol=3`) → `true`
- correct value (`next=3, sol=3`) → `false`
- re-placing the same wrong value (`prev=5, next=5, sol=3`) → `false`
- changing one wrong value to another (`prev=5, next=7, sol=3`) → `true`

### 2. Game state & flow (`app/Game.js`)

- New state `mistakeCount` (number, starts 0); module constant `MAX_MISTAKES = 3`.
- Derived `gameOver = !making && mistakeCount >= MAX_MISTAKES`.
- The two value-placement paths — `handleDigit` (keypad) and the physical-keyboard effect — compute `isStrike(board[i].value, d, solution[i])` before dispatching `setValue` in play mode and, if true, `setMistakeCount(c => c + 1)`. The existing locked-cell and given-cell guards already prevent editing correct cells, so those never reach the strike check.
- When `gameOver`, **all** input is gated off: `handleDigit`, `handleErase`, and the keyboard effect return early (the same pattern already used for `locked.has(selectedIndex)` and `confirm`). The board freezes board-wide.
- `mistakeCount` resets to 0 in `handleNewGame`, `handleReset`, `handleMakeSudoku`, and `handleStart` (entering play from make).
- A `gameOverDismissed` flag (starts false; reset wherever `mistakeCount` resets) controls whether the game-over modal is currently shown: the modal renders when `gameOver && !gameOverDismissed`.

### 3. Persistence & sync

- `mistakeCount` is added to the savegame payload and read back with a `?? 0` default. **`STORAGE_VERSION` stays 3** — the field is purely additive with a safe default, so existing in-progress games (including those already synced to live users' accounts) are preserved rather than dropped.
- Persisting the count is required for correctness: without it, reloading the page would reset strikes to 0, creating a reload-to-cheat loophole. With it, a reloaded game-over board reloads with `mistakeCount = 3`, so it stays frozen.
- `app/lib/storage.js`:
  - `saveGame({ ..., mistakeCount })` writes `mistakeCount` into the payload.
  - `loadGame` returns `mistakeCount: data.mistakeCount ?? 0`.
- Sync needs **no new logic**: `mistakeCount` rides inside the savegame blob, which is already newest-board-wins (`mergeSavegame`). The merged savegame carries its own `mistakeCount`, and `Game.js` adopts it alongside the board on sync.

### 4. UI (two small pieces)

- **`app/MistakeCounter.js`** — a small presentational component showing `Mistakes {count} / 3` (rendered near the win banner, above the board). Hidden in make mode. At `3 / 3` it renders in an alert colour. Pure: reads only `count`.
- **`app/GameOverDialog.js`** — a modal reusing `ConfirmDialog.module.css` classes (`.backdrop`, `.dialog`, `.message`, `.actions`, `.confirm`, `.cancel`). Message: "Out of mistakes — game over." Two actions: **New puzzle** (`onNewGame`) and **Reset** (`onReset`). Backdrop click / Escape calls `onDismiss`, which only closes the modal — the board stays frozen and the existing Controls bar (New game / Reset) remains the path forward, so dismissing lets the player inspect the final board.

### 5. Interaction with existing features

- **Mistake highlighting** is unchanged and is what visually marks the wrong entry that cost a strike.
- **Silent auto-lock** is unchanged; correct cells still lock.
- **Make mode** never strikes (no solution); the counter is hidden and `gameOver` is forced false via the `!making` guard.
- **Win recording** is unaffected: a frozen game-over board cannot be completed (the third strike is itself a wrong placement), so `won` cannot coincide with `gameOver`.

## File structure

- **Modify** `app/lib/validation.js` — add `isStrike`. **Test:** `app/lib/validation.test.js` (extend).
- **Modify** `app/lib/storage.js` — add `mistakeCount` (read/write, no version bump). **Test:** `app/lib/storage.test.js` (extend).
- **Create** `app/MistakeCounter.js` — counter display.
- **Create** `app/GameOverDialog.js` — game-over modal.
- **Modify** `app/page.module.css` — counter styles (modal reuses `ConfirmDialog.module.css`).
- **Modify** `app/Game.js` — state, strike logic, input gating, reset wiring, persistence, modal + counter rendering.

## Testing

- **Unit (`isStrike`):** the four cases above, plus erase (no value placed → not exercised) and given/locked cells (guarded before the call, so not part of the pure test).
- **Build:** `npm run build` compiles clean (lint is known-broken under Next 16; verify with build + `npx vitest run`).
- **Manual play:**
  - Placing three distinct wrong digits (in one cell or spread out) freezes the board and shows the game-over modal; the counter reads `3 / 3`.
  - Cycling the same wrong digit repeatedly costs only one strike.
  - Notes entries never increment the counter.
  - Reloading a frozen game keeps it frozen (count persisted).
  - New game / Reset clear the count and unfreeze; the counter returns to `0 / 3`.
  - Make mode shows no counter and never strikes.
  - Counter and modal are legible in light and dark themes on a narrow viewport.
