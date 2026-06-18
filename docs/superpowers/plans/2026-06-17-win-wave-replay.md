# Win-wave Replay Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** After the win overlay is dismissed via "Admire the board", replay the existing board golden wave and loop it about every 5 seconds until the player starts a new game.

**Architecture:** Reuse the existing `winWave` CSS animation untouched. `Game.js` runs a 5s `setInterval` (only while `won && winDismissed && !making`, skipped under reduced motion) that increments a `winReplayKey`. `Board.js` keys each cell with that value so the 81 cells re-mount and `winWave` re-fires with its per-cell `--ww` stagger on every loop.

**Tech Stack:** Next.js 16, React 19, CSS Modules. Tests via Vitest (`npm run test`). No React component-test harness exists (tests are pure-logic in `app/lib/*.test.js`), so the two UI tasks verify via `npm run test` + `npm run build` staying green plus a manual check.

## Global Constraints

- Do not modify `app/WinOverlay.js`, `app/lib/winVariants.js`, or the `winWave` keyframes / `.boardWon` CSS.
- Respect `prefers-reduced-motion`: the interval must not run when the user prefers reduced motion.
- Loop interval: 5000 ms.
- Per-cell wave stagger must be preserved on every repeat (already encoded as `--ww`, set in `Board.js`).
- The replay stops automatically when `won` becomes false (new puzzle / reset) or the component unmounts.

---

### Task 1: Board accepts a replay key that re-triggers the wave

**Files:**
- Modify: `app/Board.js`

**Interfaces:**
- Produces: `Board` accepts a new optional prop `replayKey` (number, default `0`). When `replayKey` changes, every cell re-mounts so the `winWave` animation replays. Existing props/behaviour unchanged.

- [ ] **Step 1: Add the `replayKey` prop and apply it to each cell's React key**

In `app/Board.js`, change the component signature to accept `replayKey` and fold it into each `Cell`'s key. Replace:

```js
export default function Board({ board, mistakes, sameNumber, selectedIndex, won, onSelect }) {
  const peers = peersOf(selectedIndex)
  return (
    <div className={`${styles.board} ${won ? styles.boardWon : ''}`}>
      {board.map((cell, i) => (
        <Cell
          key={i}
```

with:

```js
export default function Board({ board, mistakes, sameNumber, selectedIndex, won, replayKey = 0, onSelect }) {
  const peers = peersOf(selectedIndex)
  return (
    <div className={`${styles.board} ${won ? styles.boardWon : ''}`}>
      {board.map((cell, i) => (
        <Cell
          key={`${i}-${replayKey}`}
```

Also update the component's leading comment block to note the replay key. Change the line:

```js
// `won` plays the diagonal golden wave: each cell's delay grows with its
// row + column distance from the top-left corner.
```

to:

```js
// `won` plays the diagonal golden wave: each cell's delay grows with its
// row + column distance from the top-left corner. Bumping `replayKey`
// re-mounts the cells so that wave replays (used to loop it while admiring).
```

- [ ] **Step 2: Verify the suite and build stay green**

Run: `npm run test`
Expected: PASS (all existing lib tests pass; no test references `Board`).

Run: `npm run build`
Expected: build succeeds with no errors.

- [ ] **Step 3: Commit**

```bash
git add app/Board.js
git commit -m "Re-trigger the win wave when Board's replayKey changes

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 2: Game loops the wave every 5s while admiring

**Files:**
- Modify: `app/Game.js`

**Interfaces:**
- Consumes: `Board`'s `replayKey` prop from Task 1.
- Produces: nothing for later tasks (final task).

- [ ] **Step 1: Add the `winReplayKey` state**

In `app/Game.js`, next to the other `useState` declarations (just after the `winDismissed` state around line 61), add:

```js
  // Bumped every 5s while admiring a solved board so the Board re-plays its
  // golden wave (the win overlay covers it on mobile, so it is never seen live).
  const [winReplayKey, setWinReplayKey] = useState(0)
```

- [ ] **Step 2: Add the replay interval effect**

In `app/Game.js`, add this effect. Place it immediately after the `won` `useMemo` block (around line 94) so it reads naturally near the win logic:

```js
  // While the player is admiring a solved board (overlay dismissed), loop the
  // board's golden wave roughly every 5s by bumping winReplayKey. Skipped under
  // prefers-reduced-motion (the CSS already disables the animation there, so the
  // timer would only churn re-mounts for no visible effect). Stops when the gate
  // goes false (new puzzle / reset) or on unmount.
  useEffect(() => {
    if (!won || !winDismissed || making) return
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return
    const id = setInterval(() => setWinReplayKey((k) => k + 1), 5000)
    return () => clearInterval(id)
  }, [won, winDismissed, making])
```

(`useState` and `useEffect` are already imported in `Game.js`; if `useEffect` is somehow not in the import, add it to the existing `react` import.)

- [ ] **Step 3: Pass `replayKey` to the Board**

In `app/Game.js`, find the `<Board>` element (around line 459) and add the `replayKey` prop:

```js
          <Board
            board={board}
            mistakes={mistakes}
            sameNumber={sameNumber}
            selectedIndex={selectedIndex}
            won={won}
            replayKey={winReplayKey}
            onSelect={handleSelect}
          />
```

- [ ] **Step 4: Verify the suite and build stay green**

Run: `npm run test`
Expected: PASS.

Run: `npm run build`
Expected: build succeeds with no errors.

- [ ] **Step 5: Manual verification**

Run: `npm run dev`, open the app, and solve a puzzle (fastest path: enter the final missing digits, or use a known easy board). Then:
- Confirm the win overlay appears.
- Click "Admire the board" to dismiss it.
- Confirm the golden diagonal wave re-sweeps the board roughly every 5 seconds, with the same top-left-to-bottom-right stagger each time.
- Start a new puzzle (or Reset) and confirm the wave stops.
- (Optional) Enable "Reduce motion" in OS settings, reload, solve, dismiss — confirm no looping pulse.

- [ ] **Step 6: Commit**

```bash
git add app/Game.js
git commit -m "Loop the win wave every 5s while admiring the solved board

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Self-Review

- **Spec coverage:** Replay after dismissal (Task 2 effect + Task 1 re-mount); 5s loop (Task 2 interval); stagger preserved per repeat (Task 1 keys cells, `--ww` already set); reduced-motion skip (Task 2 guard); auto-stop on `won` false / unmount (Task 2 effect deps + cleanup); no overlay/winVariants/keyframe changes (Global Constraints). All covered.
- **Placeholder scan:** None — every code step shows exact code.
- **Type consistency:** `replayKey` prop name matches between `Board` (Task 1) and `<Board replayKey={winReplayKey}>` (Task 2); `winReplayKey` / `setWinReplayKey` consistent within Task 2.
