import Cell from './Cell'
import styles from './page.module.css'

// Renders the 9x9 grid. `conflicts` is a Set of conflicted cell indices.
export default function Board({ board, conflicts, onSet, onClear }) {
  return (
    <div className={styles.board}>
      {board.map((cell, i) => (
        <Cell
          key={i}
          cell={cell}
          index={i}
          conflicted={conflicts.has(i)}
          onSet={onSet}
          onClear={onClear}
        />
      ))}
    </div>
  )
}
