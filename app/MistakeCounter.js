'use client'
import styles from './page.module.css'

// Shows the mistake budget as a row of pips — one fills (with a small pulse)
// per mistake, and the whole row turns to the alert colour once the budget is
// exhausted. Pure presentational — reads only its props.
export default function MistakeCounter({ count, max }) {
  const className = `${styles.mistakeCounter} ${count >= max ? styles.mistakeCounterMax : ''}`
  return (
    <p className={className} aria-label={`Mistakes: ${count} of ${max}`}>
      <span>Mistakes</span>
      <span className={styles.pips} aria-hidden="true">
        {Array.from({ length: max }, (_, i) => (
          <span key={i} className={`${styles.pip} ${i < count ? styles.pipFilled : ''}`} />
        ))}
      </span>
    </p>
  )
}
