import styles from './page.module.css'

// On-screen 1-9 keypad with remaining-count badges, erase, and notes toggle.
// `remaining` is { 1..9: count }. Acts on the selected cell via handlers.
export default function Keypad({ remaining, notesMode, onDigit, onErase, onToggleNotes }) {
  return (
    <div className={styles.keypad}>
      <div className={styles.keys}>
        {Array.from({ length: 9 }, (_, k) => k + 1).map((d) => {
          const left = remaining[d]
          return (
            <button
              key={d}
              type="button"
              className={`${styles.key} ${left === 0 ? styles.keyDisabled : ''}`}
              disabled={left === 0}
              onClick={() => onDigit(d)}
            >
              {d}
              <span className={styles.keyBadge}>{left}</span>
            </button>
          )
        })}
      </div>
      <div className={styles.keyActions}>
        <button type="button" className={styles.key} onClick={onErase}>
          Erase
        </button>
        <button
          type="button"
          className={`${styles.notesToggle} ${notesMode ? styles.notesActive : ''}`}
          onClick={onToggleNotes}
        >
          Notes {notesMode ? 'on' : 'off'}
        </button>
      </div>
    </div>
  )
}
