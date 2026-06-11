import styles from './page.module.css'

// A single Sudoku cell rendered as a button. Click to select. Shows the value
// when set, otherwise a 3x3 grid of pencil marks. Given cells are read-only.
// `peer` lights the crosshair (selected row/col/box); `winDelay` staggers the
// solve wave (set as a CSS custom property, consumed by .boardWon styles).
export default function Cell({ cell, index, mistake, selected, sameNumber, peer, winDelay, onSelect }) {
  const className =
    `${styles.cell} ` +
    (cell.given ? styles.given : styles.input) +
    (peer ? ` ${styles.peer}` : '') +
    (sameNumber ? ` ${styles.sameNumber}` : '') +
    (mistake ? ` ${styles.wrong}` : '') +
    (selected ? ` ${styles.selected}` : '')

  return (
    <button
      type="button"
      className={className}
      style={winDelay != null ? { '--ww': `${winDelay}ms` } : undefined}
      onClick={() => onSelect(index)}
    >
      {cell.value != null ? (
        // Keyed by digit so the pop animation replays on every change.
        <span key={cell.value} className={styles.value}>
          {cell.value}
        </span>
      ) : cell.notes.length ? (
        <span className={styles.notes}>
          {Array.from({ length: 9 }, (_, k) => k + 1).map((d) => (
            <span key={d} className={styles.noteCell}>
              {cell.notes.includes(d) ? d : ''}
            </span>
          ))}
        </span>
      ) : (
        ''
      )}
    </button>
  )
}
