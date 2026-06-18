import Cell from './Cell'
import styles from './page.module.css'

const NO_PEERS = new Set()

// Row/col/box neighbours of the selected cell, for the crosshair highlight.
// Purely presentational, so it lives here rather than in lib/highlight.
function peersOf(selectedIndex) {
  if (selectedIndex == null) return NO_PEERS
  const row = Math.floor(selectedIndex / 9)
  const col = selectedIndex % 9
  const boxRow = row - (row % 3)
  const boxCol = col - (col % 3)
  const peers = new Set()
  for (let k = 0; k < 9; k++) {
    peers.add(row * 9 + k)
    peers.add(k * 9 + col)
    peers.add((boxRow + Math.floor(k / 3)) * 9 + boxCol + (k % 3))
  }
  peers.delete(selectedIndex)
  return peers
}

// Renders the 9x9 grid. `mistakes` and `sameNumber` are Sets of cell indices.
// `won` plays the diagonal golden wave: each cell's delay grows with its
// row + column distance from the top-left corner. Bumping `replayKey`
// re-mounts the cells so that wave replays (used to loop it while admiring).
export default function Board({ board, mistakes, sameNumber, selectedIndex, won, replayKey = 0, onSelect }) {
  const peers = peersOf(selectedIndex)
  return (
    <div className={`${styles.board} ${won ? styles.boardWon : ''}`}>
      {board.map((cell, i) => (
        <Cell
          key={`${i}-${replayKey}`}
          cell={cell}
          index={i}
          mistake={mistakes.has(i)}
          sameNumber={sameNumber.has(i)}
          peer={peers.has(i)}
          selected={i === selectedIndex}
          winDelay={won ? (Math.floor(i / 9) + (i % 9)) * 55 : null}
          onSelect={onSelect}
        />
      ))}
    </div>
  )
}
