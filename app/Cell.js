import styles from './page.module.css'

// A single Sudoku cell rendered as a button. Click to select. Shows the value
// when set, otherwise a 3x3 grid of pencil marks. Given cells are read-only.
export default function Cell({ cell, index, conflicted, selected, onSelect }) {
  const className =
    `${styles.cell} ` +
    (cell.given ? styles.given : styles.input) +
    (conflicted ? ` ${styles.wrong}` : '') +
    (selected ? ` ${styles.selected}` : '')

  return (
    <button type="button" className={className} onClick={() => onSelect(index)}>
      {cell.value != null ? (
        cell.value
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
