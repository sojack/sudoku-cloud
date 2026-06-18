'use client'
import { useReducer, useMemo, useState, useEffect, useCallback } from 'react'
import Board from './Board'
import Keypad from './Keypad'
import Controls from './Controls'
import DifficultySelect from './DifficultySelect'
import ThemeToggle from './ThemeToggle'
import StatsPanel from './StatsPanel'
import Toast from './Toast'
import AccountMenu from './AccountMenu'
import ConfirmDialog from './ConfirmDialog'
import MistakeCounter from './MistakeCounter'
import GameOverDialog from './GameOverDialog'
import WinOverlay from './WinOverlay'
import { useAuth } from './AuthProvider'
import { getSupabase } from './lib/supabase'
import { syncState, pushRemote } from './lib/sync'
import { createBoard } from './lib/board'
import { boardReducer } from './lib/reducer'
import { pushHistory, popHistory } from './lib/history'
import { mistakes as findMistakes, remainingByDigit, isSolved, lockedCells, hasEntries, isStrike } from './lib/validation'
import { sameNumberCellsForDigit } from './lib/highlight'
import { generate } from './lib/generator'
import { validatePuzzle } from './lib/makepuzzle'
import { loadGame, saveGame } from './lib/storage'
import { loadStats, saveStats } from './lib/statsStorage'
import { recordSolve, todayLocal } from './lib/stats'
import { NOTES_HIDDEN_KEY, resolveStoredHideNotes } from './lib/notesView'
import styles from './page.module.css'

const EMPTY_GIVENS = Array(81).fill(0)
const DEFAULT_DIFFICULTY = 'medium'
const NO_MISTAKES = new Set()
const MAX_MISTAKES = 3

// Monotonic id source for toast messages (module-level so it survives renders).
let toastSeq = 0

export default function Game() {
  const [board, dispatch] = useReducer(boardReducer, EMPTY_GIVENS, createBoard)
  const [givens, setGivens] = useState(EMPTY_GIVENS)
  const [solution, setSolution] = useState(EMPTY_GIVENS)
  const [difficulty, setDifficulty] = useState(DEFAULT_DIFFICULTY)
  const [category, setCategory] = useState(DEFAULT_DIFFICULTY)
  const [selectedIndex, setSelectedIndex] = useState(null)
  const [highlightDigit, setHighlightDigit] = useState(null)
  const [notesMode, setNotesMode] = useState(false)
  const [ready, setReady] = useState(false)
  const [mode, setMode] = useState('play')
  const [makeMessage, setMakeMessage] = useState(null)
  const [stats, setStats] = useState(null)
  const [solveRecorded, setSolveRecorded] = useState(false)
  const [toasts, setToasts] = useState([])
  const [notesHidden, setNotesHidden] = useState(false)
  const [confirm, setConfirm] = useState(null) // { message, onConfirm } | null
  const [mistakeCount, setMistakeCount] = useState(0)
  const [gameOverDismissed, setGameOverDismissed] = useState(false)
  // Whether the win celebration has been dismissed. Initialised from the
  // savegame's `recorded` flag on restore, so reloading an already-solved
  // board doesn't replay the overlay.
  const [winDismissed, setWinDismissed] = useState(false)
  // Bumped every 5s while admiring a solved board so the Board re-plays its
  // golden wave (the win overlay covers it on mobile, so it is never seen live).
  const [winReplayKey, setWinReplayKey] = useState(0)
  const [history, setHistory] = useState([])

  const auth = useAuth()
  const [syncStatus, setSyncStatus] = useState(null)
  // Timestamp of the last user edit (not the last persist). Drives newest-board
  // -wins sync; a restore-from-storage preserves it rather than bumping it.
  const [savedAt, setSavedAt] = useState(0)

  const making = mode === 'make'
  const mistakes = useMemo(
    () => (making ? NO_MISTAKES : findMistakes(board, solution)),
    [making, board, solution]
  )
  // Correct entries lock so they can't be edited by mistake. Disabled in make
  // mode (no solution yet), mirroring how mistakes are suppressed there.
  const locked = useMemo(
    () => (making ? NO_MISTAKES : lockedCells(board, solution)),
    [making, board, solution]
  )
  // Same-number highlighting tracks an explicit `highlightDigit` that persists
  // across empty / notes-only selections and toggles: clicking a numbered cell
  // lights its digit, clicking it again (or any cell of the lit digit) clears.
  // Gated by selection so nothing highlights when no cell is selected.
  const activeDigit = selectedIndex == null ? null : highlightDigit
  const sameNumber = useMemo(
    () => sameNumberCellsForDigit(board, activeDigit, selectedIndex),
    [board, activeDigit, selectedIndex]
  )
  const remaining = useMemo(() => remainingByDigit(board), [board])
  const won = useMemo(
    () => ready && !making && isSolved(board, solution),
    [ready, making, board, solution]
  )
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
  // Three strikes freezes the board. Never in make mode (no solution to judge).
  const gameOver = !making && mistakeCount >= MAX_MISTAKES
  // Undo is available whenever there is recorded history and the board is not
  // frozen at game over or blocked by an open dialog.
  const canUndo = history.length > 0 && !gameOver && !confirm

  const dismissToast = useCallback((id) => {
    setToasts((list) => list.filter((t) => t.id !== id))
  }, [])

  const pushToast = useCallback((text) => {
    setToasts((list) => [...list, { id: ++toastSeq, text }])
  }, [])

  // Dispatch a board action and advance the edit timestamp, except for
  // 'restore' (re-loading existing state must not count as a new edit).
  const dispatchAndStamp = useCallback((action) => {
    if (action.type !== 'restore') setSavedAt(Date.now())
    dispatch(action)
  }, [])

  // Snapshot the current board onto the undo stack, just before a mutating edit.
  // The reducer produces a fresh array per edit, so the captured reference is an
  // immutable snapshot. Session-only — never persisted or synced.
  const recordHistory = useCallback(() => {
    setHistory((stack) => pushHistory(stack, board))
  }, [board])

  // Toggle whether pencil marks are shown. Notes are never erased — only their
  // display is hidden — and the choice persists locally (not synced).
  const toggleHideNotes = useCallback(() => {
    setNotesHidden((hidden) => {
      const next = !hidden
      document.documentElement.dataset.hideNotes = next ? 'true' : 'false'
      try {
        localStorage.setItem(NOTES_HIDDEN_KEY, String(next))
      } catch {
        // storage unavailable — ignore; the attribute still applies this session
      }
      return next
    })
  }, [])

  // Restore a saved game, or generate a fresh default puzzle. Used on mount
  // and when cancelling make mode.
  const loadOrGenerate = useCallback(() => {
    const saved = loadGame()
    setGameOverDismissed(false)
    setHistory([])
    if (saved && saved.board && saved.solution) {
      dispatch({ type: 'restore', board: saved.board })
      setSolution(saved.solution)
      if (saved.difficulty) setDifficulty(saved.difficulty)
      setCategory(saved.category ?? saved.difficulty ?? DEFAULT_DIFFICULTY)
      setSolveRecorded(saved.recorded ?? false)
      setGivens(saved.board.map((c) => (c.given ? c.value : 0)))
      setSavedAt(saved.savedAt ?? 0)
      setMistakeCount(saved.mistakeCount ?? 0)
      setWinDismissed(saved.recorded ?? false)
    } else {
      const p = generate(DEFAULT_DIFFICULTY)
      dispatch({ type: 'newGame', givens: p.givens })
      setGivens(p.givens)
      setSolution(p.solution)
      setDifficulty(p.difficulty)
      setCategory(p.difficulty)
      setSolveRecorded(false)
      // An untouched auto-generated starter sorts as oldest, so a real
      // in-progress game on the cloud wins until the user actually plays.
      setSavedAt(0)
      setMistakeCount(0)
      setWinDismissed(false)
    }
  }, [])

  // On mount: restore or generate, and load stats.
  useEffect(() => {
    loadOrGenerate()
    setStats(loadStats())
    setReady(true)
  }, [loadOrGenerate])

  // Clear the highlighted digit when the selection clears (e.g. a new puzzle),
  // so a stale digit never bleeds across games.
  useEffect(() => {
    if (selectedIndex == null) setHighlightDigit(null)
  }, [selectedIndex])

  // Load the persisted hide-notes display preference (device-local) and reflect
  // it on the document so a single CSS rule can hide the pencil marks.
  useEffect(() => {
    const stored = resolveStoredHideNotes(
      typeof localStorage !== 'undefined' ? localStorage.getItem(NOTES_HIDDEN_KEY) : null
    )
    setNotesHidden(stored)
    document.documentElement.dataset.hideNotes = stored ? 'true' : 'false'
  }, [])

  // Persist the game after ready — but never while making a puzzle.
  useEffect(() => {
    if (!ready || making) return
    saveGame({ board, solution, difficulty, category, recorded: solveRecorded, savedAt, mistakeCount })
  }, [ready, making, board, solution, difficulty, category, solveRecorded, savedAt, mistakeCount])

  // Record a solve exactly once per puzzle instance, then toast any new badges.
  useEffect(() => {
    if (!ready || making || !won || solveRecorded || !stats) return
    const { stats: next, newBadges } = recordSolve(stats, {
      category,
      date: todayLocal(),
    })
    setStats(next)
    saveStats(next)
    setSolveRecorded(true)
    for (const badge of newBadges) pushToast(`🏅 ${badge.label}!`)
  }, [ready, making, won, solveRecorded, stats, category, pushToast])

  // On sign-in (or load with an existing session): reconcile local with the
  // cloud, then adopt the merged result locally and in the UI.
  const userId = auth?.user?.id ?? null
  useEffect(() => {
    if (!ready || !userId) return
    const client = getSupabase()
    if (!client) return
    let cancelled = false
    setSyncStatus('syncing')
    syncState(client, userId, { savegame: loadGame(), stats: loadStats() })
      .then((merged) => {
        if (cancelled) return
        if (merged.stats) {
          saveStats(merged.stats)
          setStats(merged.stats)
        }
        if (merged.savegame && merged.savegame.board && merged.savegame.solution) {
          saveGame(merged.savegame)
          dispatch({ type: 'restore', board: merged.savegame.board })
          setSolution(merged.savegame.solution)
          if (merged.savegame.difficulty) setDifficulty(merged.savegame.difficulty)
          setCategory(merged.savegame.category ?? merged.savegame.difficulty ?? DEFAULT_DIFFICULTY)
          setSolveRecorded(merged.savegame.recorded ?? false)
          setGivens(merged.savegame.board.map((c) => (c.given ? c.value : 0)))
          setSavedAt(merged.savegame.savedAt ?? Date.now())
          setMistakeCount(merged.savegame.mistakeCount ?? 0)
          setGameOverDismissed(false)
          setWinDismissed(merged.savegame.recorded ?? false)
          setHistory([])
        }
        setSyncStatus('synced')
      })
      .catch(() => {
        if (!cancelled) setSyncStatus('offline')
      })
    return () => {
      cancelled = true
    }
  }, [ready, userId])

  // Debounced push of local changes to the cloud while signed in. Skips while
  // making a puzzle (consistent with the local-save effect).
  useEffect(() => {
    if (!ready || making || !userId || syncStatus == null) return
    const client = getSupabase()
    if (!client) return
    const id = setTimeout(() => {
      pushRemote(client, userId, { savegame: loadGame(), stats: loadStats() })
        .then(() => setSyncStatus('synced'))
        .catch(() => setSyncStatus('offline'))
    }, 1500)
    return () => clearTimeout(id)
  }, [ready, making, userId, board, solution, difficulty, category, solveRecorded, stats])

  // When the user signs out, stop syncing. Local cache and play are untouched.
  useEffect(() => {
    if (!userId) setSyncStatus(null)
  }, [userId])

  // Select a cell. Clicking a numbered cell toggles its digit's highlight
  // (lit → cleared); clicking an empty / notes-only cell keeps the current
  // highlight, so it persists across such selections.
  function handleSelect(index) {
    setSelectedIndex(index)
    const value = board[index].value
    if (value != null) setHighlightDigit((prev) => (prev === value ? null : value))
  }

  function handleDigit(d) {
    if (selectedIndex == null || locked.has(selectedIndex) || gameOver) return
    recordHistory()
    if (notesMode) {
      dispatchAndStamp({ type: 'toggleNote', index: selectedIndex, value: d })
    } else {
      if (isStrike(board[selectedIndex].value, d, solution[selectedIndex])) {
        setMistakeCount((c) => c + 1)
      }
      dispatchAndStamp({ type: 'setValue', index: selectedIndex, value: d })
      setHighlightDigit(d)
    }
  }

  function handleErase() {
    if (selectedIndex == null || locked.has(selectedIndex) || gameOver) return
    recordHistory()
    dispatchAndStamp({ type: 'clearCell', index: selectedIndex })
  }

  // Run a board-clearing action immediately, or, when there's progress to
  // lose, ask for confirmation through the in-app modal first.
  function confirmDestructive(action, message) {
    if (hasEntries(board)) {
      setConfirm({
        message,
        onConfirm: () => {
          setConfirm(null)
          action()
        },
      })
    } else {
      action()
    }
  }

  // Memoized so the Cmd/Ctrl+Z effect can list it as a dependency and always
  // call a fresh closure — no stale `history`/`canUndo` capture.
  const handleUndo = useCallback(() => {
    if (!canUndo) return
    const { snapshot, stack } = popHistory(history)
    if (snapshot == null) return
    setHistory(stack)
    // An undo is a real user edit: stamp savedAt so it wins newest-board-wins
    // sync. dispatchAndStamp suppresses the stamp for 'restore', so dispatch the
    // restore directly and stamp here.
    setSavedAt(Date.now())
    dispatch({ type: 'restore', board: snapshot })
  }, [canUndo, history])

  function handleNewGame() {
    const p = generate(difficulty)
    dispatchAndStamp({ type: 'newGame', givens: p.givens })
    setGivens(p.givens)
    setSolution(p.solution)
    setCategory(p.difficulty)
    setSolveRecorded(false)
    setSelectedIndex(null)
    setMistakeCount(0)
    setGameOverDismissed(false)
    setWinDismissed(false)
    setHistory([])
  }

  function handleReset() {
    dispatchAndStamp({ type: 'newGame', givens })
    setSelectedIndex(null)
    setMistakeCount(0)
    setGameOverDismissed(false)
    setWinDismissed(false)
    setHistory([])
    // solveRecorded intentionally preserved — replaying the same puzzle must
    // not re-count toward stats.
  }

  function handleMakeSudoku() {
    dispatchAndStamp({ type: 'newGame', givens: EMPTY_GIVENS })
    setMode('make')
    setMakeMessage(null)
    setNotesMode(false)
    setSelectedIndex(null)
    setMistakeCount(0)
    setGameOverDismissed(false)
    setWinDismissed(false)
    setHistory([])
  }

  function handleStart() {
    const entered = board.map((c) => c.value ?? 0)
    const result = validatePuzzle(entered)
    if (result.status === 'none') {
      setMakeMessage('No solution — check your clues.')
      return
    }
    if (result.status === 'multiple') {
      setMakeMessage('Multiple solutions — add more clues.')
      return
    }
    dispatchAndStamp({ type: 'newGame', givens: entered })
    setGivens(entered)
    setSolution(result.solution)
    setCategory('custom')
    setSolveRecorded(false)
    setMode('play')
    setMakeMessage(null)
    setSelectedIndex(null)
    setMistakeCount(0)
    setGameOverDismissed(false)
    setWinDismissed(false)
    setHistory([])
  }

  function handleCancel() {
    setMode('play')
    setMakeMessage(null)
    setSelectedIndex(null)
    loadOrGenerate()
  }

  // Physical keyboard on the selected cell.
  useEffect(() => {
    function onKeyDown(e) {
      if (confirm || gameOver || selectedIndex == null || locked.has(selectedIndex)) return
      if (e.key >= '1' && e.key <= '9') {
        recordHistory()
        const d = Number(e.key)
        if (!notesMode && isStrike(board[selectedIndex].value, d, solution[selectedIndex])) {
          setMistakeCount((c) => c + 1)
        }
        dispatchAndStamp({ type: notesMode ? 'toggleNote' : 'setValue', index: selectedIndex, value: d })
        if (!notesMode) setHighlightDigit(d)
      } else if (e.key === 'Backspace' || e.key === 'Delete') {
        recordHistory()
        dispatchAndStamp({ type: 'clearCell', index: selectedIndex })
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [selectedIndex, notesMode, dispatchAndStamp, locked, confirm, gameOver, board, solution, recordHistory])

  // Undo (Cmd/Ctrl+Z). Separate from the per-cell key handler so it works with
  // no cell selected. preventDefault stops the browser's own text-undo. Ignored
  // while a modal is open or the board is frozen at game over.
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
  }, [confirm, gameOver, handleUndo])

  return (
    <div className={styles.game}>
      <header className={styles.topBar}>
        <h1 className={styles.wordmark}>
          Sudoku<span className={styles.wordmarkDot}>.</span>
        </h1>
        <div className={styles.topActions}>
          <AccountMenu syncStatus={syncStatus} />
          <ThemeToggle />
        </div>
      </header>
      <Toast toasts={toasts} onDismiss={dismissToast} />
      <div className={styles.layout}>
        <section className={styles.boardPane}>
          <div className={styles.statusRow}>
            {won && winDismissed && <p className={styles.win}>Solved ✦</p>}
            {!making && !won && <MistakeCounter count={mistakeCount} max={MAX_MISTAKES} />}
            {making && (
              <p className={styles.makeHint}>
                Enter your puzzle, then press Start.
              </p>
            )}
            {makeMessage && <p className={styles.wrong}>{makeMessage}</p>}
          </div>
          <Board
            board={board}
            mistakes={mistakes}
            sameNumber={sameNumber}
            selectedIndex={selectedIndex}
            won={won}
            replayKey={winReplayKey}
            onSelect={handleSelect}
          />
        </section>
        <aside className={styles.sidePane}>
          <Keypad
            remaining={remaining}
            notesMode={notesMode}
            notesHidden={notesHidden}
            onDigit={handleDigit}
            onErase={handleErase}
            onUndo={handleUndo}
            canUndo={canUndo}
            onToggleNotes={() => setNotesMode((m) => !m)}
            onToggleHideNotes={toggleHideNotes}
          />
          {!making && <DifficultySelect value={difficulty} onChange={setDifficulty} />}
          <Controls
            mode={mode}
            onNewGame={() =>
              confirmDestructive(handleNewGame, 'Start a new puzzle? Your current progress will be lost.')
            }
            onReset={() =>
              confirmDestructive(handleReset, 'Reset the board? All your entries will be cleared.')
            }
            onMakeSudoku={() =>
              confirmDestructive(handleMakeSudoku, 'Make a new puzzle? Your current progress will be lost.')
            }
            onStart={handleStart}
            onCancel={handleCancel}
          />
          {!making && stats && <StatsPanel stats={stats} />}
        </aside>
      </div>
      {confirm && (
        <ConfirmDialog
          message={confirm.message}
          onConfirm={confirm.onConfirm}
          onCancel={() => setConfirm(null)}
        />
      )}
      {gameOver && !gameOverDismissed && (
        <GameOverDialog
          onNewGame={handleNewGame}
          onReset={handleReset}
          onDismiss={() => setGameOverDismissed(true)}
        />
      )}
      {won && !winDismissed && (
        <WinOverlay
          category={category}
          mistakeCount={mistakeCount}
          streak={stats?.streak}
          onNewGame={handleNewGame}
          onDismiss={() => setWinDismissed(true)}
        />
      )}
    </div>
  )
}
