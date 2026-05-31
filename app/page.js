import Game from './Game'
import styles from './page.module.css'

// Default puzzle, as a flat row-major givens grid (0 = empty).
const DEFAULT_GIVENS = [
  7, 2, 0, 0, 0, 0, 0, 0, 0,
  0, 5, 0, 0, 0, 9, 0, 0, 0,
  0, 0, 0, 0, 3, 8, 0, 0, 0,
  0, 0, 0, 4, 0, 0, 5, 0, 0,
  0, 0, 3, 0, 0, 0, 9, 0, 0,
  0, 0, 1, 0, 0, 3, 0, 0, 0,
  0, 0, 0, 2, 5, 0, 0, 0, 0,
  0, 0, 0, 6, 0, 0, 0, 3, 0,
  0, 0, 0, 0, 0, 0, 0, 1, 9,
]

export default function Home() {
  return (
    <main className={styles.main}>
      <Game givens={DEFAULT_GIVENS} />
    </main>
  )
}
