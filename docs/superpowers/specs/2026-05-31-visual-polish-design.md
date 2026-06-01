# Visual Polish Design (Phase 4, part 1)

Date: 2026-05-31

## Goal

Give the game a deliberate visual identity ("Soft Warm"), add a dark mode
("Cool Slate") with OS-default plus a persisted manual toggle, and make the
layout responsive so the board and keypad are comfortable on a phone. This is
the first of several Phase 4 cycles; it is CSS/markup only — no game logic,
solver, generator, reducer, or game-persistence changes.

## Scope

Phase 4 ("Polish") is four independent areas. This cycle covers only **styling
pass + dark mode + mobile/responsive layout**. The other three are separate
later cycles and are out of scope here:

- Play aids: highlight peers / same-numbers, arrow-key navigation.
- Timer, hint button, undo/redo.

## Decisions

- **Style direction:** "Soft Warm" — warm paper background, indigo entry ink,
  rounded board, warm box borders.
- **Dark mode:** "Cool Slate" — neutral blue-grey dark, indigo entries pop.
- **Theme selection:** default follows the OS via `prefers-color-scheme`; a
  manual toggle overrides it and persists in `localStorage` under its own key
  (separate from the game save). A pre-paint inline script applies the saved
  theme before first render to avoid a flash of the wrong theme.
- **Responsive layout:** single column (same vertical stack as today). The
  board fills the width on narrow screens; the keypad stays a 9-wide row with
  count badges, with taller touch targets on small screens.
- **One refactor in scope:** move all hardcoded colors in `page.module.css`
  into CSS custom properties so both themes (and later cycles) reference one
  palette. This is necessary for theming, not gold-plating.

## Theming Architecture

Colors are defined once as CSS custom properties and consumed everywhere.

- **`app/globals.css`** holds the palette:
  - `:root` defines the light ("Soft Warm") palette.
  - `:root[data-theme='dark']` defines the dark ("Cool Slate") overrides.
  - `@media (prefers-color-scheme: dark)` applies the dark palette **when no
    explicit `data-theme` is set** (i.e. `:root:not([data-theme])`), so the OS
    preference is the default and a manual choice wins over it.
- The active theme is expressed as `data-theme="light" | "dark"` on the
  `<html>` element. Absent attribute = follow OS.

### Palette variables

Named by role (not by color) so components never hardcode a value:

| Variable | Light (Soft Warm) | Dark (Cool Slate) |
| --- | --- | --- |
| `--bg` (page) | `#faf7f0` | `#1a1d24` |
| `--surface` (keys/buttons) | `#efe9da` | `#272b34` |
| `--text` (default text) | `#3a3326` | `#e6e9f0` |
| `--muted` (notes, badges, hints) | `#7c6f57` | `#7e879b` |
| `--ink-given` (fixed clues) | `#3a3326` | `#f2f4f9` |
| `--ink-entry` (player digits) | `#5b54c9` | `#8d9bff` |
| `--cell-border` | `#e3dcc9` | `#3a3f4b` |
| `--box-border` (3×3 dividers) | `#7c6f57` | `#7e879b` |
| `--sel-bg` (selected cell) | `#e8e6fb` | `#2d3358` |
| `--peer-bg` (reserved; later cycle) | `#f0ece0` | `#23272f` |
| `--mistake-fg` | `#c0392b` | `#ff8f8f` |
| `--mistake-bg` | `#f7e3df` | `#3f2330` |
| `--accent-bg` (active toggle/difficulty) | `#e8e6fb` | `#2d3358` |
| `--win` (solved message) | `#3a7d44` | `#7fd68b` |

`--peer-bg` is defined now but not yet used; the peer-highlight cycle will
consume it. Defining it here keeps the palette coherent in one place.

## Theme Toggle

- A small client component **`ThemeToggle.js`** renders a button (☾ in light
  mode, ☀ in dark mode) that flips the theme.
- On click: compute the next theme, set `document.documentElement.dataset.theme`,
  and write it to `localStorage` under `THEME_KEY = 'sudoku-cloud:theme'`
  (values `'light' | 'dark'`).
- On mount it reflects the current resolved theme so the icon matches.
- Placed near the status/controls area (top of the game column).

### Pre-paint script (`app/layout.js`)

An inline `<script>` runs before the body renders:

```js
// reads localStorage 'sudoku-cloud:theme'; if 'light' or 'dark', sets
// document.documentElement.dataset.theme to it. Otherwise leaves it unset so
// the prefers-color-scheme media query applies.
```

This avoids a flash-of-incorrect-theme on load. It is a tiny inline script
(not a module) so it executes synchronously before paint. SSR renders no
`data-theme`; the script sets it on the client before first paint, and the
toggle keeps it in sync thereafter — no hydration mismatch because the server
never commits to a theme attribute.

### Theme resolution helper (`app/lib/theme.js`)

A pure, testable helper extracted so the toggle/script logic is verifiable:

- `THEME_KEY = 'sudoku-cloud:theme'`.
- `resolveStoredTheme(raw)` → `'light' | 'dark' | null`: returns the value if it
  is exactly `'light'` or `'dark'`, else `null` (unknown/absent → follow OS).
- `nextTheme(current)` → toggles `'light' ↔ 'dark'`.

The inline pre-paint script duplicates the tiny read-and-apply logic inline
(it cannot import a module synchronously), but `ThemeToggle` imports the helper
so the persisted-value parsing is unit-tested in one place.

## Responsive Layout

Single column, same stack order: status → (win/hint message) → board → keypad
→ difficulty → controls. No DOM reordering; CSS only.

- **Board:** replace the fixed `40px` cells. The `.board` gets
  `width: min(92vw, 30rem)` and `aspect-ratio: 1`; cells size from the grid
  (`.cell` drops fixed `width`/`height`, keeps `aspect-ratio: 1`). Cell font
  scales with viewport, e.g. `font-size: clamp(1rem, 4.5vw, 1.5rem)`; note
  digits scale similarly smaller.
- **`.main`:** replace `height: 100vh; width: 100vw` with min-height and
  padding so content can scroll on short screens; center horizontally.
- **Keypad:** keep the 9-wide `.keys` row; keys get `aspect-ratio` / larger
  `min-height` and a `@media (max-width: 480px)` block bumps touch-target size.
  Count badges remain.
- **Buttons (controls/difficulty/keypad/toggle):** use `--surface` background,
  `--text` color, a subtle border, and consistent radius; active states
  (`.notesActive`, `.difficultyActive`) use `--accent-bg`.
- **Box borders:** the existing `.cell:nth-child(...)` 3×3 divider rules switch
  from hardcoded `black` to `var(--box-border)`; the base `.cell` border uses
  `var(--cell-border)`.

## Components (`app/`)

- **`globals.css`** — palette variables (light + dark + OS media query); base
  `body` uses `--bg`/`--text`.
- **`page.module.css`** — all colors replaced by `var(--…)`; board/cell sizing
  made responsive; keypad touch targets; button styling pass.
- **`ThemeToggle.js`** (new) — the toggle button; imports `theme.js`.
- **`app/lib/theme.js`** (new) — `THEME_KEY`, `resolveStoredTheme`, `nextTheme`.
- **`app/lib/theme.test.js`** (new) — unit tests for the helper.
- **`layout.js`** — add the pre-paint inline theme script in `<head>`/before
  body; metadata unchanged.
- **`Game.js`** — render `<ThemeToggle />` in the game column (near the top).
  No state/logic changes otherwise.
- **`Board.js` / `Cell.js` / `Keypad.js` / `Controls.js` / `DifficultySelect.js`
  / `StatusBar.js`** — unchanged markup; they pick up the new variables via the
  shared stylesheet. (Class names are unchanged.)

## Testing Strategy

- **`app/lib/theme.js`** — unit tests (Vitest): `resolveStoredTheme` returns
  `'light'`/`'dark'` for those exact strings and `null` for `null`, `''`,
  and unknown values; `nextTheme` toggles both directions.
- **UI** — verified via `npm run build` and manual play, consistent with prior
  phases:
  - Light and dark both legible; givens vs entries vs selection vs mistake all
    distinguishable in each theme.
  - Toggle flips the theme and the choice persists across refresh; with no
    stored choice, the OS setting is honored; no flash of wrong theme on load.
  - At ~360px width the board fills the screen and the keypad is thumb-usable;
    nothing overflows horizontally.

## Out of Scope (later Phase 4 cycles)

- Peer / same-number highlighting (will consume the reserved `--peer-bg`).
- Arrow-key navigation between cells.
- Timer, hint button, undo/redo.
- Animations/transitions beyond basic, any icon/font libraries, logo/branding.
