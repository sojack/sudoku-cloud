import styles from './page.module.css'

// Live game status: conflict count and per-digit remaining counts.
export default function StatusBar({ conflictCount, remaining }) {
  return (
    <div className={styles.status}>
      <p className={conflictCount > 0 ? styles.wrong : undefined}>
        Conflicts: {conflictCount}
      </p>
      <div className={styles.remaining}>
        {Array.from({ length: 9 }, (_, k) => k + 1).map((d) => (
          <span
            key={d}
            className={remaining[d] === 0 ? styles.digitDone : undefined}
          >
            {d}: {remaining[d]}
          </span>
        ))}
      </div>
    </div>
  )
}
