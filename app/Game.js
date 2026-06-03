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
import { useAuth } from './AuthProvider'
import { getSupabase } from './lib/supabase'
import { syncState, pushRemote } from './lib/sync'
import { createBoard } from './lib/board'
import { boardReducer } from './lib/reducer'
import { mistakes as findMistakes, remainingByDigit, isSolved } from './lib/validation'
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

// Monotonic id source for toast messages (module-level so it survives renders).
let toastSeq = 0

export default function Game() {
  const [board, dispatch] = useReducer(boardReducer, EMPTY_GIVENS, createBoard)
  const [givens, setGivens] = useState(EMPTY_GIVENS)
  const [solution, setSolution] = useState(EMPTY_GIVENS)
  const [difficulty, setDifficulty] = useState(DEFAULT_DIFFICULTY)
  const [category, setCategory] = useState(DEFAULT_DIFFICULTY)
  const [selectedIndex, setSelectedIndex] = useState(null)
  const [lastDigit, setLastDigit] = useState(null)
  const [notesMode, setNotesMode] = useState(false)
  const [ready, setReady] = useState(false)
  const [mode, setMode] = useState('play')
  const [makeMessage, setMakeMessage] = useState(null)
  const [stats, setStats] = useState(null)
  const [solveRecorded, setSolveRecorded] = useState(false)
  const [toasts, setToasts] = useState([])
  const [notesHidden, setNotesHidden] = useState(false)

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
  // Same-number highlighting persists the last digit under the cursor: when an
  // empty or notes-only cell is selected, the previously highlighted number
  // stays lit until another numbered cell is selected. `highlightDigit` falls
  // back to the remembered `lastDigit`; nothing highlights with no selection.
  const selectedValue = selectedIndex != null ? board[selectedIndex].value : null
  const highlightDigit = selectedIndex == null ? null : selectedValue ?? lastDigit
  const sameNumber = useMemo(
    () => sameNumberCellsForDigit(board, highlightDigit, selectedIndex),
    [board, highlightDigit, selectedIndex]
  )
  const remaining = useMemo(() => remainingByDigit(board), [board])
  const won = useMemo(
    () => ready && !making && isSolved(board, solution),
    [ready, making, board, solution]
  )

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
    if (saved && saved.board && saved.solution) {
      dispatch({ type: 'restore', board: saved.board })
      setSolution(saved.solution)
      if (saved.difficulty) setDifficulty(saved.difficulty)
      setCategory(saved.category ?? saved.difficulty ?? DEFAULT_DIFFICULTY)
      setSolveRecorded(saved.recorded ?? false)
      setGivens(saved.board.map((c) => (c.given ? c.value : 0)))
      setSavedAt(saved.savedAt ?? 0)
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
    }
  }, [])

  // On mount: restore or generate, and load stats.
  useEffect(() => {
    loadOrGenerate()
    setStats(loadStats())
    setReady(true)
  }, [loadOrGenerate])

  // Remember the digit under the cursor so same-number highlighting persists
  // when an empty / notes-only cell is selected. Clears when selection clears
  // (e.g. a new puzzle), so a stale digit never bleeds across games.
  useEffect(() => {
    if (selectedIndex == null) setLastDigit(null)
    else if (selectedValue != null) setLastDigit(selectedValue)
  }, [selectedIndex, selectedValue])

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
    saveGame({ board, solution, difficulty, category, recorded: solveRecorded, savedAt })
  }, [ready, making, board, solution, difficulty, category, solveRecorded, savedAt])

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

  function handleDigit(d) {
    if (selectedIndex == null) return
    dispatchAndStamp({ type: notesMode ? 'toggleNote' : 'setValue', index: selectedIndex, value: d })
  }

  function handleErase() {
    if (selectedIndex == null) return
    dispatchAndStamp({ type: 'clearCell', index: selectedIndex })
  }

  function handleNewGame() {
    const p = generate(difficulty)
    dispatchAndStamp({ type: 'newGame', givens: p.givens })
    setGivens(p.givens)
    setSolution(p.solution)
    setCategory(p.difficulty)
    setSolveRecorded(false)
    setSelectedIndex(null)
  }

  function handleReset() {
    dispatchAndStamp({ type: 'newGame', givens })
    setSelectedIndex(null)
    // solveRecorded intentionally preserved — replaying the same puzzle must
    // not re-count toward stats.
  }

  function handleMakeSudoku() {
    dispatchAndStamp({ type: 'newGame', givens: EMPTY_GIVENS })
    setMode('make')
    setMakeMessage(null)
    setNotesMode(false)
    setSelectedIndex(null)
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
      if (selectedIndex == null) return
      if (e.key >= '1' && e.key <= '9') {
        dispatchAndStamp({ type: notesMode ? 'toggleNote' : 'setValue', index: selectedIndex, value: Number(e.key) })
      } else if (e.key === 'Backspace' || e.key === 'Delete') {
        dispatchAndStamp({ type: 'clearCell', index: selectedIndex })
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [selectedIndex, notesMode, dispatchAndStamp])

  return (
    <div className={styles.game}>
      <ThemeToggle />
      <AccountMenu syncStatus={syncStatus} />
      <Toast toasts={toasts} onDismiss={dismissToast} />
      {won && <p className={styles.win}>Solved! 🎉</p>}
      {making && (
        <p className={styles.makeHint}>
          Enter your puzzle, then press Start.
        </p>
      )}
      {makeMessage && <p className={styles.wrong}>{makeMessage}</p>}
      <Board
        board={board}
        mistakes={mistakes}
        sameNumber={sameNumber}
        selectedIndex={selectedIndex}
        onSelect={setSelectedIndex}
      />
      <Keypad
        remaining={remaining}
        notesMode={notesMode}
        notesHidden={notesHidden}
        onDigit={handleDigit}
        onErase={handleErase}
        onToggleNotes={() => setNotesMode((m) => !m)}
        onToggleHideNotes={toggleHideNotes}
      />
      {!making && <DifficultySelect value={difficulty} onChange={setDifficulty} />}
      <Controls
        mode={mode}
        onNewGame={handleNewGame}
        onReset={handleReset}
        onMakeSudoku={handleMakeSudoku}
        onStart={handleStart}
        onCancel={handleCancel}
      />
      {!making && stats && <StatsPanel stats={stats} />}
    </div>
  )
}
