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

### Phase 3 — Puzzle variety

- [x] Puzzle generator + solver with difficulty levels
- [ ] "Make sudoku" mode: clear board, enter a puzzle, solve it

### Phase 4 — Polish

- [ ] Styling pass + dark mode + mobile layout
- [ ] Timer, hint button, undo / redo
- [ ] Highlight peers / same-numbers
- [ ] Keyboard navigation between cells

## History

Original scratch to-do (superseded by the roadmap above):

- ✅ add check / error count
- add style
- add input digits (custom ui)
- add input count (found/total)
- random sudoku
- make sudoku: clears board, allow inputs, click done to solve
