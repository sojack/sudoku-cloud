import Cell from './Cell'
import styles from './page.module.css'

// Renders the 9x9 grid. `mistakes` is a Set of cell indices that differ from
// the solution.
export default function Board({ board, mistakes, selectedIndex, onSelect }) {
  return (
    <div className={styles.board}>
      {board.map((cell, i) => (
        <Cell
          key={i}
          cell={cell}
          index={i}
          mistake={mistakes.has(i)}
          selected={i === selectedIndex}
          onSelect={onSelect}
        />
      ))}
    </div>
  )
}
