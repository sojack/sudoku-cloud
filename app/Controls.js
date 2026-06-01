import styles from './page.module.css'

// Game controls. In play mode: New game / Reset / Make sudoku.
// In make mode: Start / Cancel.
export default function Controls({ mode, onNewGame, onReset, onMakeSudoku, onStart, onCancel }) {
  if (mode === 'make') {
    return (
      <div className={styles.controls}>
        <button type="button" className={styles.controlBtn} onClick={onStart}>
          Start
        </button>
        <button type="button" className={styles.controlBtn} onClick={onCancel}>
          Cancel
        </button>
      </div>
    )
  }
  return (
    <div className={styles.controls}>
      <button type="button" className={styles.controlBtn} onClick={onNewGame}>
        New game
      </button>
      <button type="button" className={styles.controlBtn} onClick={onReset}>
        Reset
      </button>
      <button type="button" className={styles.controlBtn} onClick={onMakeSudoku}>
        Make sudoku
      </button>
    </div>
  )
}
