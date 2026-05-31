import styles from './page.module.css'

// New game / Reset controls.
export default function Controls({ onNewGame, onReset }) {
  return (
    <div className={styles.controls}>
      <button type="button" className={styles.controlBtn} onClick={onNewGame}>
        New game
      </button>
      <button type="button" className={styles.controlBtn} onClick={onReset}>
        Reset
      </button>
    </div>
  )
}
