import styles from './page.module.css'

// Live game status: count of cells that differ from the solution.
export default function StatusBar({ mistakeCount }) {
  return (
    <div className={styles.status}>
      <p className={mistakeCount > 0 ? styles.wrong : undefined}>
        Mistakes: {mistakeCount}
      </p>
    </div>
  )
}
