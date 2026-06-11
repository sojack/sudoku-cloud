'use client'
import styles from './page.module.css'

// Shows how many mistakes the player has made out of the allowed budget. Turns
// to the alert colour once the budget is exhausted. Pure presentational — reads
// only its props.
export default function MistakeCounter({ count, max }) {
  const className = `${styles.mistakeCounter} ${count >= max ? styles.mistakeCounterMax : ''}`
  return (
    <p className={className}>
      Mistakes {count} / {max}
    </p>
  )
}
