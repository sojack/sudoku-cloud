# Same-Number Highlighting Design (Phase 4, part 2)

Date: 2026-05-31

## Goal

When the selected cell holds a value, highlight every other cell that already
holds the same digit, so the player can see at a glance where a number lives on
the board. This is a small, self-contained Phase 4 cycle; it adds no new
persistent state and no game-logic changes beyond a pure derivation.

## Decisions

- **Highlight scope:** same-number only (not peers). Peer/row/column/box
  shading is out of scope.
- **Empty selected cell:** highlights nothing extra — only the normal selection
  styling shows (there is no number to match).
- **Match basis:** filled values only. A cell matches when its `value` equals
  the selected cell's `value`. Pencil notes are ignored.
- **Logic location:** a pure helper `sameNumberCells(board, selectedIndex)` in a
  new `app/lib/highlight.js`, returning a `Set` of indices — parallel to the
  existing `mistakes(board, solution)`.
- **Styling:** reuse the already-defined `--peer-bg` palette variable (added,
  reserved, in the visual-polish cycle) for the highlight fill. Selection and
  mistake styles take visual precedence.

## Logic Library (`app/lib/highlight.js`, new)

Pure, unit-tested. No React.

- **`sameNumberCells(board, selectedIndex)`** → `Set<number>` of cell indices to
  highlight:
  - Returns an empty set when `selectedIndex` is `null`/`undefined`.
  - Returns an empty set when the selected cell's `value` is `null` (empty cell).
  - Otherwise returns every index `i` where `i !== selectedIndex` and
    `board[i].value === board[selectedIndex].value`.
  - Notes never cause a match (only `value` is compared).

The board is the existing 81-cell array of `{ value, given, notes }`.

## Data Flow

Mirrors how `mistakes` already flows from `Game` → `Board` → `Cell`.

- **`Game.js`** computes
  `const sameNumber = useMemo(() => sameNumberCells(board, selectedIndex), [board, selectedIndex])`
  and passes the `Set` to `Board` as a `sameNumber` prop.
- **`Board.js`** passes `sameNumber={sameNumber.has(i)}` to each `Cell`
  (alongside the existing `mistake` / `selected` flags).
- **`Cell.js`** adds the `styles.sameNumber` class when its `sameNumber` flag is
  true.

No new state: the highlight is derived from the existing `board` and
`selectedIndex`.

## Styling (`app/page.module.css`)

- Add a `.sameNumber` rule using `background: var(--peer-bg)`.
- **Precedence:** the selected cell's `.selected` background and the
  `.wrong` mistake styling must visually win over `.sameNumber`. Achieve this by
  ordering the class application in `Cell` so `selected` / `wrong` come after
  `sameNumber` in the className string (later classes / equal-specificity rules
  later in the stylesheet win), and by placing `.selected` after `.sameNumber`
  in `page.module.css`. A mistaken cell that also matches still reads as a
  mistake; the selected cell still reads as selected.

## Components Touched (`app/`)

- `app/lib/highlight.js` (new) — `sameNumberCells`.
- `app/lib/highlight.test.js` (new) — unit tests.
- `Game.js` — import the helper, compute the memo, pass `sameNumber` to `Board`.
- `Board.js` — accept `sameNumber` (a `Set`), pass per-cell boolean to `Cell`.
- `Cell.js` — accept `sameNumber` prop, apply `styles.sameNumber`.
- `page.module.css` — add `.sameNumber`.

No changes to `reducer.js`, `solver.js`, `generator.js`, `validation.js`,
`storage.js`, or `board.js`. No persistence change.

## Testing Strategy

- **TDD, Vitest, colocated `*.test.js`.**
- **`highlight.js`:**
  - `null` selected index → empty set.
  - selected cell empty (`value === null`) → empty set, even if other cells have
    values.
  - selected cell has value `n` → set of all other indices with `value === n`;
    excludes the selected index itself.
  - a cell with `n` only in its `notes` (no value) is NOT included.
  - a value that appears only once (just the selected cell) → empty set.
- **UI** — verified via `npm run build` and manual play:
  - Selecting a filled cell highlights all other cells with that digit; the
    selected and mistaken cells still read correctly.
  - Selecting an empty cell adds no highlight.
  - Highlight updates live as the selection or values change; legible in both
    light and dark themes.

## Out of Scope (later Phase 4 cycles)

- Peer (row/column/box) highlighting.
- Highlighting cells that merely have the digit pencilled in.
- Arrow-key navigation between cells.
- Timer, hint button, undo/redo.
