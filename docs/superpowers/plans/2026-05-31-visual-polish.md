# Visual Polish Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Apply the "Soft Warm" visual style with a "Cool Slate" dark mode (OS-default + persisted manual toggle) and a single-column responsive layout — CSS/markup only, no game-logic changes.

**Architecture:** Define the whole palette as CSS custom properties in `globals.css` (light `:root`, dark `:root[data-theme='dark']`, plus an OS media query that applies dark only when no `data-theme` is set). Replace every hardcoded color in `page.module.css` with `var(--…)` and make the board/keypad responsive. A pure `app/lib/theme.js` helper (unit-tested) backs a `ThemeToggle` client component; a pre-paint inline script in `layout.js` applies the saved theme before first render.

**Tech Stack:** Next.js 16 (App Router) + React 19, CSS Modules + global CSS variables, Vitest.

---

## Current State (read before starting)

- `app/globals.css`: defines `--background`/`--foreground` (unused by the game), base `body` styles, `* { box-sizing }`, `a`. No theming.
- `app/layout.js`: `RootLayout` renders `<html lang="en"><body>{children}</body></html>`; imports `./globals.css`; exports `metadata`.
- `app/page.module.css`: hardcoded colors throughout —
  - `.cell` border `lightgray`, color `gray`; box dividers `.cell:nth-child(...)` use `black` (right borders at 9n+3/9n+6; bottom borders across the 27n+19..27 ranges).
  - `.input` `cornflowerblue`; `.given` `#171717`; `.selected` `#e8f0fe`; `.noteCell` `gray`; `.win` `seagreen`; `.wrong` `red`; `.keyBadge` `gray`; `.notesActive`/`.difficultyActive` `#e8f0fe`; `.makeHint` `gray`.
  - `.main` is `height:100vh; width:100vw`. `.cell` is fixed `40px`×`40px`. `.board` is `grid-template-columns: repeat(9,1fr)` with `margin-top:1em`. `.keys` is `repeat(9,1fr)`; `.key` `min-width:34px`.
- `app/Game.js`: client component; renders (in order) `StatusBar`, optional win `<p>`, optional make hint, `Board`, `Keypad`, optional `DifficultySelect`, `Controls`, all inside `<div className={styles.game}>`.
- Test runner: `npm run test` (vitest). Build: `npm run build`. Current suite: 70 tests, 8 files.

## File Structure (created / modified)

- `app/lib/theme.js` (create) — `THEME_KEY`, `resolveStoredTheme`, `nextTheme`.
- `app/lib/theme.test.js` (create) — unit tests.
- `app/ThemeToggle.js` (create) — toggle button (client component).
- `app/globals.css` (modify) — palette variables + OS media query + body.
- `app/layout.js` (modify) — pre-paint inline theme script.
- `app/page.module.css` (modify) — variables + responsive sizing.
- `app/Game.js` (modify) — render `<ThemeToggle />`.

---

## Task 1: Theme helper

**Files:**
- Create: `app/lib/theme.js`
- Test: `app/lib/theme.test.js`

- [ ] **Step 1: Write the failing tests** — create `app/lib/theme.test.js`:

```js
import { describe, it, expect } from 'vitest'
import { THEME_KEY, resolveStoredTheme, nextTheme } from './theme'

describe('resolveStoredTheme', () => {
  it('returns "light" and "dark" for those exact strings', () => {
    expect(resolveStoredTheme('light')).toBe('light')
    expect(resolveStoredTheme('dark')).toBe('dark')
  })

  it('returns null for null, empty, or unknown values', () => {
    expect(resolveStoredTheme(null)).toBe(null)
    expect(resolveStoredTheme('')).toBe(null)
    expect(resolveStoredTheme('blue')).toBe(null)
    expect(resolveStoredTheme(undefined)).toBe(null)
  })
})

describe('nextTheme', () => {
  it('toggles between light and dark', () => {
    expect(nextTheme('light')).toBe('dark')
    expect(nextTheme('dark')).toBe('light')
  })
})

describe('THEME_KEY', () => {
  it('is the namespaced storage key', () => {
    expect(THEME_KEY).toBe('sudoku-cloud:theme')
  })
})
```

- [ ] **Step 2: Run test, verify it fails**

Run: `npm run test -- theme`
Expected: FAIL (module not found).

- [ ] **Step 3: Implement** — create `app/lib/theme.js`:

```js
// Theme persistence helpers. The active theme is reflected as
// document.documentElement.dataset.theme ('light' | 'dark'); absent = follow OS.

export const THEME_KEY = 'sudoku-cloud:theme'

// A stored theme value is only valid if it is exactly 'light' or 'dark'.
// Anything else (absent, empty, unknown) means "follow the OS preference".
export function resolveStoredTheme(raw) {
  return raw === 'light' || raw === 'dark' ? raw : null
}

export function nextTheme(current) {
  return current === 'dark' ? 'light' : 'dark'
}
```

- [ ] **Step 4: Run test, verify it passes**

Run: `npm run test -- theme`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add app/lib/theme.js app/lib/theme.test.js
git commit -m "Add theme persistence helpers"
```

---

## Task 2: Palette variables in globals.css

**Files:**
- Modify: `app/globals.css`

- [ ] **Step 1: Replace the contents of `app/globals.css`** with the palette (light `:root`, dark override, OS media query) and body wired to variables:

```css
:root {
  /* Light — "Soft Warm" */
  --bg: #faf7f0;
  --surface: #efe9da;
  --text: #3a3326;
  --muted: #7c6f57;
  --ink-given: #3a3326;
  --ink-entry: #5b54c9;
  --cell-border: #e3dcc9;
  --box-border: #7c6f57;
  --sel-bg: #e8e6fb;
  --peer-bg: #f0ece0; /* reserved for the peer-highlight cycle */
  --mistake-fg: #c0392b;
  --mistake-bg: #f7e3df;
  --accent-bg: #e8e6fb;
  --win: #3a7d44;
}

/* Dark — "Cool Slate". Applied when the user has explicitly chosen dark... */
:root[data-theme='dark'] {
  --bg: #1a1d24;
  --surface: #272b34;
  --text: #e6e9f0;
  --muted: #7e879b;
  --ink-given: #f2f4f9;
  --ink-entry: #8d9bff;
  --cell-border: #3a3f4b;
  --box-border: #7e879b;
  --sel-bg: #2d3358;
  --peer-bg: #23272f;
  --mistake-fg: #ff8f8f;
  --mistake-bg: #3f2330;
  --accent-bg: #2d3358;
  --win: #7fd68b;
}

/* ...or when the OS prefers dark AND no explicit theme is set. */
@media (prefers-color-scheme: dark) {
  :root:not([data-theme]) {
    --bg: #1a1d24;
    --surface: #272b34;
    --text: #e6e9f0;
    --muted: #7e879b;
    --ink-given: #f2f4f9;
    --ink-entry: #8d9bff;
    --cell-border: #3a3f4b;
    --box-border: #7e879b;
    --sel-bg: #2d3358;
    --peer-bg: #23272f;
    --mistake-fg: #ff8f8f;
    --mistake-bg: #3f2330;
    --accent-bg: #2d3358;
    --win: #7fd68b;
  }
}

html,
body {
  max-width: 100vw;
  overflow-x: hidden;
}

body {
  color: var(--text);
  background: var(--bg);
  font-family: Arial, Helvetica, sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}

* {
  box-sizing: border-box;
  padding: 0;
  margin: 0;
}

a {
  color: inherit;
}
```

- [ ] **Step 2: Build to confirm CSS is valid**

Run: `npm run build`
Expected: SUCCESS (no visual assertions yet; just confirms the stylesheet compiles).

- [ ] **Step 3: Commit**

```bash
git add app/globals.css
git commit -m "Define Soft Warm / Cool Slate palette as CSS variables"
```

---

## Task 3: Pre-paint theme script in layout.js

**Files:**
- Modify: `app/layout.js`

- [ ] **Step 1: Rewrite `app/layout.js`** to apply the saved theme before paint via an inline script in `<head>`:

```js
import "./globals.css";

export const metadata = {
  title: "Sudoku Cloud",
  description: "a sudoku playground",
};

// Runs before paint: if a valid saved theme exists, set data-theme so the
// correct palette applies immediately (no flash). Otherwise leave it unset so
// prefers-color-scheme decides. Mirrors resolveStoredTheme in app/lib/theme.js.
const themeScript = `(function(){try{var t=localStorage.getItem('sudoku-cloud:theme');if(t==='light'||t==='dark'){document.documentElement.dataset.theme=t;}}catch(e){}})();`;

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body>
        {children}
      </body>
    </html>
  );
}
```

- [ ] **Step 2: Build**

Run: `npm run build`
Expected: SUCCESS.

- [ ] **Step 3: Commit**

```bash
git add app/layout.js
git commit -m "Apply saved theme before paint to avoid flash"
```

---

## Task 4: ThemeToggle component

**Files:**
- Create: `app/ThemeToggle.js`
- Modify: `app/page.module.css` (add toggle styles — full responsive rewrite happens in Task 5, but the toggle classes are added here so the component renders)

- [ ] **Step 1: Create `app/ThemeToggle.js`:**

```js
'use client'
import { useEffect, useState } from 'react'
import { THEME_KEY, resolveStoredTheme, nextTheme } from './lib/theme'
import styles from './page.module.css'

// Light/dark toggle. Reflects the resolved theme and persists the choice.
export default function ThemeToggle() {
  const [theme, setTheme] = useState('light')

  // On mount, read the resolved theme: explicit data-theme, else stored, else
  // the OS preference. (The pre-paint script in layout.js may have set it.)
  useEffect(() => {
    const attr = document.documentElement.dataset.theme
    const stored = resolveStoredTheme(
      typeof localStorage !== 'undefined' ? localStorage.getItem(THEME_KEY) : null
    )
    const osDark =
      typeof window !== 'undefined' &&
      window.matchMedia &&
      window.matchMedia('(prefers-color-scheme: dark)').matches
    setTheme(attr || stored || (osDark ? 'dark' : 'light'))
  }, [])

  function toggle() {
    const next = nextTheme(theme)
    document.documentElement.dataset.theme = next
    try {
      localStorage.setItem(THEME_KEY, next)
    } catch {
      // storage unavailable — ignore; the attribute still applies for this session
    }
    setTheme(next)
  }

  return (
    <button
      type="button"
      className={styles.themeToggle}
      onClick={toggle}
      aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
    >
      {theme === 'dark' ? '☀' : '☾'}
    </button>
  )
}
```

- [ ] **Step 2: Add the toggle style to `app/page.module.css`** (append; the full color/responsive pass is Task 5):

```css
.themeToggle {
  align-self: flex-end;
  margin-bottom: 0.5rem;
  padding: 0.3rem 0.6rem;
  font-size: 1rem;
  cursor: pointer;
  background: var(--surface);
  color: var(--text);
  border: 1px solid var(--cell-border);
  border-radius: 6px;
}
```

- [ ] **Step 3: Build**

Run: `npm run build`
Expected: SUCCESS.

- [ ] **Step 4: Commit**

```bash
git add app/ThemeToggle.js app/page.module.css
git commit -m "Add theme toggle component"
```

---

## Task 5: Themed + responsive page.module.css

**Files:**
- Modify: `app/page.module.css`

- [ ] **Step 1: Replace the contents of `app/page.module.css`** with the variable-driven, responsive version. (This preserves the `.themeToggle` rule added in Task 4 and every existing class name; only colors and sizing change.)

```css
.main {
  display: flex;
  flex-direction: column;
  justify-content: flex-start;
  align-items: center;
  min-height: 100vh;
  width: 100%;
  padding: 1.5rem 1rem 3rem;
}

.game {
  display: flex;
  flex-direction: column;
  align-items: center;
  width: 100%;
  max-width: 30rem;
}

.themeToggle {
  align-self: flex-end;
  margin-bottom: 0.5rem;
  padding: 0.3rem 0.6rem;
  font-size: 1rem;
  cursor: pointer;
  background: var(--surface);
  color: var(--text);
  border: 1px solid var(--cell-border);
  border-radius: 6px;
}

.board {
  display: grid;
  grid-template-columns: repeat(9, 1fr);
  width: min(92vw, 30rem);
  aspect-ratio: 1;
  margin-top: 1em;
  border: 2px solid var(--box-border);
  border-radius: 8px;
  overflow: hidden;
}

.cell {
  aspect-ratio: 1;
  border: 1px solid var(--cell-border);
  text-align: center;
  font-size: clamp(1rem, 4.5vw, 1.5rem);
  color: var(--text);
  font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Open Sans', 'Helvetica Neue', sans-serif;
  font-weight: bold;
  background: none;
  padding: 0;
  cursor: pointer;
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
}
.cell:nth-child(9n+3) {
  border-right-color: var(--box-border);
}
.cell:nth-child(9n+6) {
  border-right-color: var(--box-border);
}
.cell:nth-child(27n+19):nth-child(-n+70) {
  border-bottom-color: var(--box-border);
}
.cell:nth-child(27n+20):nth-child(-n+70) {
  border-bottom-color: var(--box-border);
}
.cell:nth-child(27n+21):nth-child(-n+70) {
  border-bottom-color: var(--box-border);
}
.cell:nth-child(27n+22):nth-child(-n+70) {
  border-bottom-color: var(--box-border);
}
.cell:nth-child(27n+23):nth-child(-n+70) {
  border-bottom-color: var(--box-border);
}
.cell:nth-child(27n+24):nth-child(-n+70) {
  border-bottom-color: var(--box-border);
}
.cell:nth-child(27n+25):nth-child(-n+70) {
  border-bottom-color: var(--box-border);
}
.cell:nth-child(27n+26):nth-child(-n+70) {
  border-bottom-color: var(--box-border);
}
.cell:nth-child(27n+27):nth-child(-n+70) {
  border-bottom-color: var(--box-border);
}

/* Player-entered digits */
.input {
  color: var(--ink-entry);
}

/* Fixed clues */
.given {
  color: var(--ink-given);
}

.selected {
  background: var(--sel-bg);
}

.notes {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  grid-template-rows: repeat(3, 1fr);
  width: 100%;
  height: 100%;
}

.noteCell {
  font-size: clamp(0.5rem, 1.6vw, 0.6rem);
  line-height: 1;
  color: var(--muted);
  display: flex;
  align-items: center;
  justify-content: center;
}

.status {
  text-align: center;
}

.win {
  margin-top: 0.5rem;
  font-weight: bold;
  color: var(--win);
}

.wrong {
  color: var(--mistake-fg);
}

.keypad {
  margin-top: 1rem;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.5rem;
  width: 100%;
}

.keys {
  display: grid;
  grid-template-columns: repeat(9, 1fr);
  gap: 0.25rem;
  width: 100%;
}

.key {
  position: relative;
  min-height: 2.75rem;
  padding: 0.4rem 0.25rem;
  font-size: 1rem;
  cursor: pointer;
  background: var(--surface);
  color: var(--ink-entry);
  border: 1px solid var(--cell-border);
  border-radius: 6px;
}

.keyBadge {
  position: absolute;
  top: 1px;
  right: 3px;
  font-size: 8px;
  color: var(--muted);
}

.keyDisabled {
  opacity: 0.4;
  cursor: default;
}

.keyActions {
  display: flex;
  gap: 0.5rem;
}

.notesToggle {
  padding: 0.4rem 0.6rem;
  cursor: pointer;
  background: var(--surface);
  color: var(--text);
  border: 1px solid var(--cell-border);
  border-radius: 6px;
}

.notesActive {
  background: var(--accent-bg);
  font-weight: bold;
}

.controls {
  margin-top: 1rem;
  display: flex;
  gap: 0.5rem;
  flex-wrap: wrap;
  justify-content: center;
}

.controlBtn {
  padding: 0.4rem 0.8rem;
  cursor: pointer;
  background: var(--surface);
  color: var(--text);
  border: 1px solid var(--cell-border);
  border-radius: 6px;
}

.difficulty {
  margin-top: 1rem;
  display: flex;
  gap: 0.5rem;
}

.difficultyBtn {
  padding: 0.4rem 0.8rem;
  cursor: pointer;
  background: var(--surface);
  color: var(--text);
  border: 1px solid var(--cell-border);
  border-radius: 6px;
}

.difficultyActive {
  background: var(--accent-bg);
  font-weight: bold;
}

.makeHint {
  margin-top: 0.5rem;
  color: var(--muted);
}

/* Larger touch targets on phones */
@media (max-width: 480px) {
  .key {
    min-height: 3.25rem;
    font-size: 1.1rem;
  }
  .controlBtn,
  .difficultyBtn,
  .notesToggle {
    padding: 0.55rem 0.7rem;
  }
}
```

- [ ] **Step 2: Build**

Run: `npm run build`
Expected: SUCCESS.

- [ ] **Step 3: Commit**

```bash
git add app/page.module.css
git commit -m "Theme all game styles via variables; responsive board and keypad"
```

---

## Task 6: Render the toggle in Game

**Files:**
- Modify: `app/Game.js`

- [ ] **Step 1: Add the import and render the toggle.** In `app/Game.js`, add the import near the other component imports:

```js
import ThemeToggle from './ThemeToggle'
```

Then, inside the returned JSX, make `<ThemeToggle />` the first child of the `<div className={styles.game}>` wrapper (above `<StatusBar … />`):

```jsx
  return (
    <div className={styles.game}>
      <ThemeToggle />
      <StatusBar mistakeCount={making ? null : mistakes.size} />
      {/* …everything else unchanged… */}
```

Leave all other Game logic, state, handlers, and child components exactly as they are.

- [ ] **Step 2: Build**

Run: `npm run build`
Expected: SUCCESS.

- [ ] **Step 3: Commit**

```bash
git add app/Game.js
git commit -m "Render theme toggle at the top of the game"
```

---

## Task 7: Full suite + manual verification

**Files:** none.

- [ ] **Step 1: Run the full suite**

Run: `npm run test`
Expected: PASS — including the new `theme` tests (73 tests across 9 files).

- [ ] **Step 2: Run the app**

Run: `npm run dev` → open http://localhost:3000

- [ ] **Step 3: Verify the checklist**

- [ ] Light mode shows the Soft Warm palette: warm paper background, indigo player entries, dark-warm givens, indigo selection, red mistakes.
- [ ] The toggle (☾/☀) flips light↔dark; the Cool Slate dark palette applies (blue-grey background, lighter indigo entries).
- [ ] The chosen theme persists across a refresh; with no choice stored, the OS setting is honored; there is no flash of the wrong theme on load (test by setting dark, refreshing).
- [ ] Givens, entries, selection, peers-not-yet, and mistakes are all distinguishable in BOTH themes.
- [ ] At ~360px width (devtools device toolbar): the board fills the width, the 1–9 keypad row is thumb-usable with count badges intact, controls wrap, and nothing overflows horizontally.
- [ ] Notes (3×3 pencil marks) remain legible in a cell at small sizes.

---

## Task 8: Update the roadmap

**Files:**
- Modify: `README.md`

- [ ] **Step 1:** In `README.md` under "Phase 4 — Polish", mark the styling item done:

```markdown
- [x] Styling pass + dark mode + mobile layout
- [ ] Timer, hint button, undo / redo
- [ ] Highlight peers / same-numbers
- [ ] Keyboard navigation between cells
```

(Leave the other three unchecked and do not mark the Phase 4 heading complete — only the first item ships in this cycle.)

- [ ] **Step 2: Commit**

```bash
git add README.md
git commit -m "Mark styling/dark-mode/mobile complete in README roadmap"
```

---

## Self-Review (completed by plan author)

- **Spec coverage:** theme variables + light/dark palettes + OS media query (Task 2); pre-paint flash avoidance (Task 3); theme resolution helper + unit tests (Task 1); toggle component overriding OS and persisting (Task 4, 6); all `page.module.css` colors → variables + responsive board/keypad/touch targets (Task 5); reserved `--peer-bg` defined (Task 2). Every spec section maps to a task.
- **Type/name consistency:** `THEME_KEY`/`resolveStoredTheme`/`nextTheme` defined in Task 1, consumed in Task 4; the inline script in Task 3 hardcodes the same `'sudoku-cloud:theme'` key and the same `'light'|'dark'` validation as `resolveStoredTheme` (documented as an intentional inline duplicate since a module can't be imported synchronously pre-paint). Variable names in the Task 2 palette exactly match the `var(--…)` references in Task 5.
- **Ordering:** Tasks 1–4 are independent and keep the build green; Task 5's full CSS rewrite re-states the `.themeToggle` rule from Task 4 (so no class is lost); Task 6 wires the toggle in. The app builds after every task.
- **Placeholder scan:** none — every CSS/JS step shows complete content.

## Out of Scope (later Phase 4 cycles)

Peer / same-number highlighting (consumes the reserved `--peer-bg`); arrow-key navigation; timer, hint, undo/redo. No animations, icon/font libraries, or branding.
