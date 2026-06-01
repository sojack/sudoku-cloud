'use client'
import { useReducer, useMemo, useState, useEffect } from 'react'
import Board from './Board'
import StatusBar from './StatusBar'
import Keypad from './Keypad'
import Controls from './Controls'
import DifficultySelect from './DifficultySelect'
import { createBoard } from './lib/board'
import { boardReducer } from './lib/reducer'
import { mistakes as findMistakes, remainingByDigit, isSolved } from './lib/validation'
import { generate } from './lib/generator'
import { loadGame, saveGame } from './lib/storage'
import styles from './page.module.css'

const EMPTY_GIVENS = Array(81).fill(0)
const DEFAULT_DIFFICULTY = 'medium'

export default function Game() {
  // First paint is a deterministic empty board (no generation during SSR).
  const [board, dispatch] = useReducer(boardReducer, EMPTY_GIVENS, createBoard)
  const [givens, setGivens] = useState(EMPTY_GIVENS)
  const [solution, setSolution] = useState(EMPTY_GIVENS)
  const [difficulty, setDifficulty] = useState(DEFAULT_DIFFICULTY)
  const [selectedIndex, setSelectedIndex] = useState(null)
  const [notesMode, setNotesMode] = useState(false)
  const [ready, setReady] = useState(false)

  const mistakes = useMemo(() => findMistakes(board, solution), [board, solution])
  const remaining = useMemo(() => remainingByDigit(board), [board])
  const won = useMemo(() => ready && isSolved(board, solution), [ready, board, solution])

  // On mount: restore a saved game, or generate a fresh default puzzle.
  useEffect(() => {
    const saved = loadGame()
    if (saved && saved.board && saved.solution) {
      dispatch({ type: 'restore', board: saved.board })
      setSolution(saved.solution)
      if (saved.difficulty) setDifficulty(saved.difficulty)
      // Reconstruct givens from the restored board (given cells).
      setGivens(saved.board.map((c) => (c.given ? c.value : 0)))
    } else {
      const p = generate(DEFAULT_DIFFICULTY)
      dispatch({ type: 'newGame', givens: p.givens })
      setGivens(p.givens)
      setSolution(p.solution)
      setDifficulty(p.difficulty)
    }
    setReady(true)
  }, [])

  // Persist after the game is ready (skip the pre-generation empty board).
  useEffect(() => {
    if (!ready) return
    saveGame({ board, solution, difficulty })
  }, [ready, board, solution, difficulty])

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
      <StatusBar mistakeCount={mistakes.size} />
      {won && <p className={styles.win}>Solved! 🎉</p>}
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
      <DifficultySelect value={difficulty} onChange={setDifficulty} />
      <Controls onNewGame={handleNewGame} onReset={handleReset} />
    </div>
  )
}
