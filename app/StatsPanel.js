'use client'
import { useState } from 'react'
import { BADGES } from './lib/stats'
import styles from './page.module.css'

// Collapsible stats display: streak, solved counts, and the badge grid.
// Default collapsed to keep the play screen clean. Pure presentational —
// reads only from `stats`.
export default function StatsPanel({ stats }) {
  const [open, setOpen] = useState(false)
  const earned = new Set(stats.badges)

  return (
    <div className={styles.stats}>
      <button
        type="button"
        className={styles.statsToggle}
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
      >
        {open ? 'Hide stats' : 'Stats'}
      </button>
      {open && (
        <div className={styles.statsBody}>
          <p className={styles.statLine}>
            Streak: {stats.streak.current} (best {stats.streak.best})
          </p>
          <p className={styles.statLine}>Solved: {stats.solved.total}</p>
          <p className={styles.statBreakdown}>
            Easy {stats.solved.easy} · Medium {stats.solved.medium} · Hard{' '}
            {stats.solved.hard} · Custom {stats.solved.custom}
          </p>
          <div className={styles.badgeGrid}>
            {BADGES.map((b) => (
              <div
                key={b.id}
                className={`${styles.badge} ${
                  earned.has(b.id) ? styles.badgeEarned : styles.badgeLocked
                }`}
                title={b.label}
              >
                {b.label}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
