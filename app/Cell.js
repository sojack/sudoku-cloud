import styles from './page.module.css'

// A single Sudoku cell. Given cells are read-only; editable cells accept a
// single digit 1-9. An empty value clears the cell.
export default function Cell({ cell, index, conflicted, onSet, onClear }) {
  function handleChange(e) {
    const raw = e.target.value.replace(/[^1-9]/g, '').slice(-1)
    if (raw === '') {
      onClear(index)
    } else {
      onSet(index, Number(raw))
    }
  }

  const className =
    `${styles.cell} ` +
    (cell.given ? styles.given : styles.input) +
    (conflicted ? ` ${styles.wrong}` : '')

  if (cell.given) {
    return (
      <input
        readOnly
        type="tel"
        className={className}
        value={cell.value ?? ''}
      />
    )
  }

  return (
    <input
      type="tel"
      maxLength={1}
      className={className}
      value={cell.value ?? ''}
      onChange={handleChange}
    />
  )
}
