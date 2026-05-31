import Game from './Game'
import { PUZZLES } from './lib/puzzles'
import styles from './page.module.css'

export default function Home() {
  return (
    <main className={styles.main}>
      <Game puzzle={PUZZLES[0]} />
    </main>
  )
}
