import styles from './page.module.css'

// Live game status: count of cells that differ from the solution.
// When mistakeCount is null (e.g. entering a puzzle), the line is hidden.
export default function StatusBar({ mistakeCount }) {
  return (
    <div className={styles.status}>
      {mistakeCount != null && (
        <p className={mistakeCount > 0 ? styles.wrong : undefined}>
          Mistakes: {mistakeCount}
        </p>
      )}
    </div>
  )
}
