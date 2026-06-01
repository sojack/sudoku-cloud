import Cell from './Cell'
import styles from './page.module.css'

// Renders the 9x9 grid. `mistakes` and `sameNumber` are Sets of cell indices.
export default function Board({ board, mistakes, sameNumber, selectedIndex, onSelect }) {
  return (
    <div className={styles.board}>
      {board.map((cell, i) => (
        <Cell
          key={i}
          cell={cell}
          index={i}
          mistake={mistakes.has(i)}
          sameNumber={sameNumber.has(i)}
          selected={i === selectedIndex}
          onSelect={onSelect}
        />
      ))}
    </div>
  )
}
