# Win-wave replay while admiring the board

**Date:** 2026-06-17

## Problem

When a puzzle is solved, the board plays a one-time diagonal golden "wave"
(`.boardWon .cell` running the `winWave` keyframe, each cell delayed by `--ww`
= (row + col) × 55ms). At the same moment, `WinOverlay` mounts a full-screen
`position: fixed` glass backdrop. On mobile the backdrop covers the board
entirely, so the wave plays *behind* the overlay and is finished before the
player ever sees the board.

The overlay's "Admire the board" button (`WinOverlay.js`) already dismisses the
overlay (`onDismiss` → `setWinDismissed(true)`), revealing the solved board —
but the wave does not replay, because a CSS animation only fires once per mount.

## Goal

After the overlay is dismissed via "Admire the board" (i.e. `won && winDismissed`),
replay the existing board wave and loop it about every 5 seconds, preserving the
original diagonal stagger on every repeat. The loop runs until the player acts
(new puzzle, reset, navigate away); it stops on its own when `won` goes false.

## Approach

JS-driven replay that reuses the existing animation untouched. A `setInterval`
in `Game.js` bumps a counter every 5s while the player is admiring; the counter
flows to `Board`, which uses it to re-mount the cells so `winWave` re-fires with
its per-cell `--ww` delays — the same diagonal sweep, every loop.

Rejected alternative: a pure-CSS `infinite` loop with an idle gap baked into the
keyframe. `animation-delay` only applies to the first iteration, so every repeat
after the first would pulse all 81 cells in unison, losing the diagonal stagger.

## Changes

### `app/Game.js`
- Add state: `const [winReplayKey, setWinReplayKey] = useState(0)`.
- Add an effect gated on `won && winDismissed && !making` that, unless the user
  prefers reduced motion, starts a 5s `setInterval` calling
  `setWinReplayKey((k) => k + 1)`. Cleanup clears the interval (so it stops when
  the gate goes false or the component unmounts).
  - Reduced motion: read `window.matchMedia('(prefers-reduced-motion: reduce)').matches`
    and skip starting the interval when true (the CSS already neutralizes the
    animation; this just avoids pointless re-mounts).
- Pass `replayKey={winReplayKey}` to `<Board>`.

### `app/Board.js`
- Accept a `replayKey` prop (default 0).
- Re-trigger the wave by keying each cell with the replay key:
  `key={`${i}-${replayKey}`}`. The initial solve uses key 0 (plays once under
  the overlay, exactly as today); each interval tick after dismissal re-mounts
  the 81 cells and replays `winWave` with the stagger.

### No changes
- `WinOverlay.js`, `app/lib/winVariants.js`, and the `winWave` keyframes / CSS
  are untouched. The `prefers-reduced-motion` CSS guard already covers
  `.boardWon .cell`.

## Behavior notes
- Identical on desktop and mobile; mobile (overlay fully covers the board) is the
  motivating case.
- Reload of an already-solved board stays quiet: `winDismissed` initializes from
  the savegame `recorded` flag, but the replay only matters visually right after
  a fresh dismissal — and re-mounting cells with the held end-state (`both` fill)
  is a no-op pulse, harmless either way.
- Cells remain clickable across re-mounts; selection is derived from props, so it
  re-renders correctly.

## Testing
- Repo tests are pure-logic (`app/lib/*.test.js`); the replay is timer/effect +
  visual, with no new pure unit to extract. Verify manually: solve a puzzle, press
  "Admire the board", confirm the wave re-sweeps roughly every 5s and stops on a
  new puzzle. Confirm `npx vitest run` and `npm run build` stay green.
