'use client'
import { useReducer, useMemo } from 'react'
import Board from './Board'
import StatusBar from './StatusBar'
import { createBoard } from './lib/board'
import { boardReducer } from './lib/reducer'
import {
  conflicts as findConflicts,
  remainingByDigit,
  isWon,
} from './lib/validation'
import styles from './page.module.css'

// Wires the board reducer to the UI and derives game status from the lib.
export default function Game({ givens }) {
  const [board, dispatch] = useReducer(boardReducer, givens, createBoard)

  const conflicts = useMemo(() => findConflicts(board), [board])
  const remaining = useMemo(() => remainingByDigit(board), [board])
  const won = useMemo(() => isWon(board), [board])

  function handleSet(index, value) {
    dispatch({ type: 'setCell', index, value })
  }

  function handleClear(index) {
    dispatch({ type: 'clearCell', index })
  }

  return (
    <div className={styles.game}>
      <StatusBar conflictCount={conflicts.size} remaining={remaining} />
      {won && <p className={styles.win}>Solved! 🎉</p>}
      <Board
        board={board}
        conflicts={conflicts}
        onSet={handleSet}
        onClear={handleClear}
      />
    </div>
  )
}
