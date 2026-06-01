'use client'
import { useReducer, useMemo, useState, useEffect, useCallback } from 'react'
import Board from './Board'
import StatusBar from './StatusBar'
import Keypad from './Keypad'
import Controls from './Controls'
import DifficultySelect from './DifficultySelect'
import { createBoard } from './lib/board'
import { boardReducer } from './lib/reducer'
import { mistakes as findMistakes, remainingByDigit, isSolved } from './lib/validation'
import { generate } from './lib/generator'
import { validatePuzzle } from './lib/makepuzzle'
import { loadGame, saveGame } from './lib/storage'
import styles from './page.module.css'

const EMPTY_GIVENS = Array(81).fill(0)
const DEFAULT_DIFFICULTY = 'medium'
const NO_MISTAKES = new Set()

export default function Game() {
  const [board, dispatch] = useReducer(boardReducer, EMPTY_GIVENS, createBoard)
  const [givens, setGivens] = useState(EMPTY_GIVENS)
  const [solution, setSolution] = useState(EMPTY_GIVENS)
  const [difficulty, setDifficulty] = useState(DEFAULT_DIFFICULTY)
  const [selectedIndex, setSelectedIndex] = useState(null)
  const [notesMode, setNotesMode] = useState(false)
  const [ready, setReady] = useState(false)
  const [mode, setMode] = useState('play')
  const [makeMessage, setMakeMessage] = useState(null)

  const making = mode === 'make'
  const mistakes = useMemo(
    () => (making ? NO_MISTAKES : findMistakes(board, solution)),
    [making, board, solution]
  )
  const remaining = useMemo(() => remainingByDigit(board), [board])
  const won = useMemo(
    () => ready && !making && isSolved(board, solution),
    [ready, making, board, solution]
  )

  // Restore a saved game, or generate a fresh default puzzle. Used on mount
  // and when cancelling make mode.
  const loadOrGenerate = useCallback(() => {
    const saved = loadGame()
    if (saved && saved.board && saved.solution) {
      dispatch({ type: 'restore', board: saved.board })
      setSolution(saved.solution)
      if (saved.difficulty) setDifficulty(saved.difficulty)
      setGivens(saved.board.map((c) => (c.given ? c.value : 0)))
    } else {
      const p = generate(DEFAULT_DIFFICULTY)
      dispatch({ type: 'newGame', givens: p.givens })
      setGivens(p.givens)
      setSolution(p.solution)
      setDifficulty(p.difficulty)
    }
  }, [])

  // On mount: restore or generate.
  useEffect(() => {
    loadOrGenerate()
    setReady(true)
  }, [loadOrGenerate])

  // Persist after the game is ready — but never while making a puzzle.
  useEffect(() => {
    if (!ready || making) return
    saveGame({ board, solution, difficulty })
  }, [ready, making, board, solution, difficulty])

  function handleDigit(d) {
    if (selectedIndex == null) return
    dispatch({ type: notesMode ? 'toggleNote' : 'setValue', index: selectedIndex, value: d })
  }

  function handleErase() {
    if (selectedIndex == null) return
    dispatch({ type: 'clearCell', index: selectedIndex })
  }

  function handleNewGame() {
    const p = generate(difficulty)
    dispatch({ type: 'newGame', givens: p.givens })
    setGivens(p.givens)
    setSolution(p.solution)
    setSelectedIndex(null)
  }

  function handleReset() {
    dispatch({ type: 'newGame', givens })
    setSelectedIndex(null)
  }

  function handleMakeSudoku() {
    dispatch({ type: 'newGame', givens: EMPTY_GIVENS })
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
    dispatch({ type: 'newGame', givens: entered })
    setGivens(entered)
    setSolution(result.solution)
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
        dispatch({ type: notesMode ? 'toggleNote' : 'setValue', index: selectedIndex, value: Number(e.key) })
      } else if (e.key === 'Backspace' || e.key === 'Delete') {
        dispatch({ type: 'clearCell', index: selectedIndex })
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [selectedIndex, notesMode])

  return (
    <div className={styles.game}>
      <StatusBar mistakeCount={making ? null : mistakes.size} />
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
        selectedIndex={selectedIndex}
        onSelect={setSelectedIndex}
      />
      <Keypad
        remaining={remaining}
        notesMode={notesMode}
        onDigit={handleDigit}
        onErase={handleErase}
        onToggleNotes={() => setNotesMode((m) => !m)}
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
    </div>
  )
}
