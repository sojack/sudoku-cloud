# Undo Design

**Date:** 2026-06-10

## Goal

Let the player undo their recent moves, one at a time, back to the start of the current puzzle. The motivating case: placing a *value* when you meant to place a *note* wipes that digit from the notes of up to 20 peer cells (row, column, box) with no clean recovery today. A single undo restores the whole prior board, bringing those notes back.

## Background

`boardReducer` (`app/lib/reducer.js`) already has a `restore` action that swaps in a complete 81-cell board. `setValue` is destructive across cells: it clears the target cell's notes *and* strips the placed digit from every peer's notes, and `clearCell` does not bring them back. Undo is the right fix, and the existing `restore` action makes a snapshot-based undo natural.

The mistake budget (shipped just before this feature) counts a strike on each new wrong value placement, freezes the board at three strikes, and persists the count.

## Decisions (settled during brainstorming)

- **Depth:** multi-step undo, **no redo**. Cmd/Ctrl+Z (and a button) walks back through recent moves to the start of the puzzle.
- **Scope:** **session-only, in-memory**. History is never persisted to localStorage and never synced. A reload or a sync-adopt keeps the board but clears history.
- **Strikes:** undo restores the board but **never refunds a strike**. Refunding would reopen the spam exploit the budget closed (probe a digit, read the red flag, undo the cost). `mistakeCount` is not part of a snapshot.
- **Game over:** undo is **disabled** once the board is frozen at game over.
- **Mechanism:** a snapshot ("memento") stack — push the whole board before each edit; undo restores the latest snapshot — rather than inverse operations.

## Out of scope

- Redo.
- Persisting or syncing history.
- Refunding strikes / reviving from game over via undo.
- A depth cap (memory is negligible; full-puzzle history is at most a few hundred small arrays).

## Detailed design

### 1. Pure history helpers (`app/lib/history.js`)

A tiny pure module, unit-tested, so the stack contract is verified independent of React:

```js
// An undo history is an array of board snapshots, oldest first. These helpers
// are pure: they return new arrays and never mutate their inputs.

// Append a snapshot, returning a new stack.
export function pushHistory(stack, snapshot) {
  return [...stack, snapshot]
}

// Remove and return the most recent snapshot. Returns { snapshot, stack }:
// `snapshot` is null and `stack` is unchanged (empty) when there is nothing to
// undo.
export function popHistory(stack) {
  if (stack.length === 0) return { snapshot: null, stack }
  return { snapshot: stack[stack.length - 1], stack: stack.slice(0, -1) }
}
```

### 2. Game state & wiring (`app/Game.js`)

- New in-memory state `const [history, setHistory] = useState([])`. Board snapshots are the existing 81-cell `board` array (the reducer already produces fresh arrays per edit, so a captured reference is an immutable snapshot).
- A helper records history immediately before a mutating dispatch:

  ```js
  const recordHistory = useCallback(() => {
    setHistory((stack) => pushHistory(stack, board))
  }, [board])
  ```

  `recordHistory()` is called at the top of the value-placement, note-toggle, and erase paths in both `handleDigit`/`handleErase` and the physical-keyboard effect — i.e. wherever a `setValue` / `toggleNote` / `clearCell` is dispatched through `dispatchAndStamp`.
- `canUndo = history.length > 0 && !gameOver`.
- `handleUndo`:

  ```js
  function handleUndo() {
    if (!canUndo) return
    const { snapshot, stack } = popHistory(history)
    if (snapshot == null) return
    setHistory(stack)
    setSavedAt(Date.now())
    dispatch({ type: 'restore', board: snapshot })
  }
  ```

  It dispatches `restore` directly (not through `dispatchAndStamp`, which suppresses the savedAt stamp for `restore`) and stamps `savedAt` explicitly, because an undo *is* a user edit that should win newest-board-wins sync.
- History is cleared (`setHistory([])`) in `handleNewGame`, `handleReset`, `handleMakeSudoku`, `handleStart`, `loadOrGenerate` (mount / cancel-make), and the sync-adopt branch — undo never crosses a puzzle boundary.

### 3. Keyboard shortcut

A dedicated effect, separate from the per-cell key handler (so undo works with no cell selected):

```js
useEffect(() => {
  function onKey(e) {
    if ((e.metaKey || e.ctrlKey) && !e.shiftKey && (e.key === 'z' || e.key === 'Z')) {
      if (confirm || gameOver) return
      e.preventDefault()
      handleUndo()
    }
  }
  window.addEventListener('keydown', onKey)
  return () => window.removeEventListener('keydown', onKey)
}, [confirm, gameOver, history])
```

`preventDefault` stops the browser's own text-undo. It is ignored while a modal is open or at game over.

### 4. UI

The keypad's action row (`app/Keypad.js`) gains an **Undo** button beside Erase, wired through new `onUndo` and `canUndo` props. It is `disabled` when `!canUndo` and reuses the existing `.key` / `.keyDisabled` styling — no new CSS needed.

### 5. Interaction with existing features

- **Mistake budget:** `mistakeCount` is never snapshotted, so undo cannot refund a strike or revive a frozen game. `canUndo` is false at game over.
- **Silent lock:** restoring an earlier board recomputes `locked` from that board, so a cell that was locked-correct becomes editable again if undo removes its value — consistent and expected.
- **Win:** undoing after a solve reverts the last placement (un-setting `won`); the solve is already recorded and `solveRecorded` is persisted, so no re-record occurs. No special-casing.
- **Make mode:** the same edit handlers push history, so undo works while building a puzzle too (`gameOver` is always false there). History clears on entering/leaving make mode.

## File structure

- **Create** `app/lib/history.js` — pure `pushHistory` / `popHistory`. **Test:** `app/lib/history.test.js`.
- **Modify** `app/Game.js` — history state, `recordHistory`, `handleUndo`, clearing on puzzle boundaries, Cmd/Ctrl+Z effect, pass `onUndo`/`canUndo` to the keypad.
- **Modify** `app/Keypad.js` — Undo button and the two new props.

## Testing

- **Unit (`history.js`):** `pushHistory` appends without mutating the input; `popHistory` returns the last snapshot and the shortened stack; `popHistory` on an empty stack returns `{ snapshot: null, stack: [] }`.
- **Build:** `npm run build` compiles clean (lint is known-broken under Next 16; verify with build + `npx vitest run`).
- **Manual play:**
  - Place a value where a note was intended (wiping peer notes), press Undo → the value is removed and the wiped peer notes return.
  - Multiple edits then repeated Undo walks back move by move to the puzzle's start; the button disables when history is empty.
  - Cmd/Ctrl+Z performs the same undo, works with no cell selected, and does not trigger the browser's text-undo.
  - Undo of a wrong placement removes the number but the mistake counter does **not** decrease.
  - Undo is disabled at game over and while a confirm / game-over modal is open.
  - New game / Reset / Make / Start clear history (Undo becomes disabled).
  - A page reload clears history (board persists) — Undo is disabled until a new edit.
  - The Undo button is legible and correctly enabled/disabled in light and dark themes on a narrow viewport.
