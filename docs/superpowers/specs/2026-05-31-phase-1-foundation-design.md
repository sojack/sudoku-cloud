# Phase 1 — Foundation Design

Date: 2026-05-31

## Goal

Turn the proof-of-concept into a correct, controlled Sudoku game with
rule-based validation and win detection, built on a clean, testable
foundation that later phases can extend without rework.

## Decisions

- **Validation:** rule-based conflicts only (row / column / box). No
  check-against-solution in Phase 1.
- **Status display:** live conflict count + per-digit remaining count. Drop a
  separate "cells remaining" (redundant with per-digit).
- **Solution array:** dropped. A win is mathematically guaranteed by
  "board full + zero rule conflicts" for a valid puzzle.
- **Code structure:** pure game logic in plain JS modules under `app/lib/`
  (no React, fully unit-testable); UI split into focused components.
- **Testing:** TDD with Vitest on the logic lib. UI verified by build +
  manual play.
- **State management:** `useReducer` with a pure reducer living in the lib.

## Data Model

A puzzle is defined by a **givens grid**: 81 cells, each a digit `1–9` or
empty. Live game state is a flat, row-major array of 81 cells:

```js
board = [ { value: 1-9 | null, given: boolean }, ... ]  // index 0..80
```

- `given: true` cells are fixed clues (read-only).
- Other cells are player-editable; `value` is `null` when empty.
- Replaces the old `'x'` sentinel and `r0c0` location strings with flat
  indices `0..80` plus helpers for `index ↔ {row, col, box}`.

## Logic Library (`app/lib/`)

Pure functions, no React. Each unit-tested.

- **`grid.js`** — index helpers: `rowOf(i)`, `colOf(i)`, `boxOf(i)`,
  `peersOf(i)` (the 20 cells sharing a row/col/box), and the 9-index groups.
- **`board.js`** — board construction: `createBoard(givens)` builds the
  81-cell array from a givens grid; `isEditable(board, i)`.
- **`validation.js`** — `conflicts(board)` returns the set of indices that
  violate a rule (a filled cell whose value duplicates a peer's value);
  `conflictCount(board)`; `remainingByDigit(board)` → `{1..9: count left}`;
  `isComplete(board)` (all filled); `isWon(board)` (complete + no conflicts).
- **`reducer.js`** — `boardReducer(state, action)` with actions:
  `setCell({index, value})`, `clearCell({index})`, `newGame({givens})`.
  Ignores edits to `given` cells. Pure and directly testable.

## Components (`app/`)

- **`page.js`** (`Home`) — holds the default puzzle givens, sets up the
  reducer, renders `Game`.
- **`Game.js`** — wires reducer state to `StatusBar` and `Board`; computes
  derived data (conflicts set, remaining, won) from the lib; shows a win
  state when `isWon`.
- **`Board.js`** — renders the 9×9 grid of `Cell`s; passes per-cell
  conflict flag and dispatch handlers.
- **`Cell.js`** — single controlled input. Read-only when `given`. Shows a
  conflict style when its index is in the conflicts set. Accepts only 1–9;
  empty clears the cell.
- **`StatusBar.js`** — renders conflict count and per-digit remaining.

## Validation Behaviour

- A cell is flagged when its filled value equals the value of any peer
  (same row, column, or 3×3 box). Both members of a duplicate are flagged.
- Conflict highlighting is live on every edit.
- Conflict count is the number of flagged cells (or distinct conflicts —
  implementation picks one and documents it; flagged-cell count is the
  user-facing number).

## Win Detection

`isWon(board)` is true when every cell is filled and `conflicts(board)` is
empty. `Game` surfaces a victory message in that state.

## Cleanup

Remove dead code as part of the refactor:

- `app/components/Cell.js` (unused stub)
- `app/test/` (scratch playground)
- commented-out `resetBoard` / edit-button blocks and stray `console.log`s

## Out of Scope (later phases)

Custom keypad, notes/pencil mode, new-game/reset UI, persistence (Phase 2);
puzzle generation/solver (Phase 3); styling pass, timer, hints, undo,
keyboard nav (Phase 4).

## Testing Strategy

- Vitest unit tests for every lib module (`*.test.js` colocated in
  `app/lib/`). TDD: test first, then implement.
- Cover: index helpers, board construction, conflict detection (rows,
  columns, boxes, and combinations), remaining-by-digit, completeness,
  win detection, and every reducer action including no-op edits to givens.
- UI verified via `npm run build` and manual play.
