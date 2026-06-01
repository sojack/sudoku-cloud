'use client'
import { useReducer, useMemo, useState, useEffect } from 'react'
import Board from './Board'
import StatusBar from './StatusBar'
import Keypad from './Keypad'
import Controls from './Controls'
import { createBoard } from './lib/board'
import { boardReducer } from './lib/reducer'
import { mistakes as findMistakes, remainingByDigit, isSolved } from './lib/validation'
import { nextPuzzleId, puzzleById } from './lib/puzzles'
import { loadGame, saveGame } from './lib/storage'
import styles from './page.module.css'

export default function Game({ puzzle }) {
  const [board, dispatch] = useReducer(boardReducer, puzzle.givens, createBoard)
  const [selectedIndex, setSelectedIndex] = useState(null)
  const [notesMode, setNotesMode] = useState(false)
  const [puzzleId, setPuzzleId] = useState(puzzle.id)

  const solution = useMemo(() => puzzleById(puzzleId).solution, [puzzleId])
  const mistakes = useMemo(() => findMistakes(board, solution), [board, solution])
  const remaining = useMemo(() => remainingByDigit(board), [board])
  const won = useMemo(() => isSolved(board, solution), [board, solution])

  // Resume a saved game on mount (client only).
  useEffect(() => {
    const saved = loadGame()
    if (saved && saved.board) {
      dispatch({ type: 'restore', board: saved.board })
      if (saved.puzzleId) setPuzzleId(saved.puzzleId)
    }
  }, [])

  // Persist on every board/puzzle change.
  useEffect(() => {
    saveGame({ board, puzzleId })
  }, [board, puzzleId])

  function handleDigit(d) {
    if (selectedIndex == null) return
    dispatch({ type: notesMode ? 'toggleNote' : 'setValue', index: selectedIndex, value: d })
  }

  function handleErase() {
    if (selectedIndex == null) return
    dispatch({ type: 'clearCell', index: selectedIndex })
  }

  function handleNewGame() {
    const id = nextPuzzleId(puzzleId)
    dispatch({ type: 'newGame', givens: puzzleById(id).givens })
    setPuzzleId(id)
    setSelectedIndex(null)
  }

  function handleReset() {
    dispatch({ type: 'newGame', givens: puzzleById(puzzleId).givens })
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
      <Controls onNewGame={handleNewGame} onReset={handleReset} />
    </div>
  )
}
