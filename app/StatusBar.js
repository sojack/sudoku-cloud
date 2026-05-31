import styles from './page.module.css'

// Live game status: conflict count only (per-digit remaining now on the keypad).
export default function StatusBar({ conflictCount }) {
  return (
    <div className={styles.status}>
      <p className={conflictCount > 0 ? styles.wrong : undefined}>
        Conflicts: {conflictCount}
      </p>
    </div>
  )
}
