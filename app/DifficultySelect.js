import styles from './page.module.css'
import { DIFFICULTIES } from './lib/generator'

// Difficulty picker. `value` is the active difficulty key; `onChange(key)` sets it.
export default function DifficultySelect({ value, onChange }) {
  return (
    <div className={styles.difficulty}>
      {DIFFICULTIES.map((d) => (
        <button
          key={d.key}
          type="button"
          className={`${styles.difficultyBtn} ${value === d.key ? styles.difficultyActive : ''}`}
          onClick={() => onChange(d.key)}
        >
          {d.label}
        </button>
      ))}
    </div>
  )
}
