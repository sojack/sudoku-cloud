'use client'
import { useEffect } from 'react'
import styles from './ConfirmDialog.module.css'

// Shown when the mistake budget is exhausted. The board is already frozen by the
// caller; this announces game over and offers the two ways forward. Backdrop
// click or Escape dismisses the dialog (so the player can inspect the final
// board) without unfreezing — the Controls bar remains the path forward.
export default function GameOverDialog({ onNewGame, onReset, onDismiss }) {
  useEffect(() => {
    function onKey(e) {
      if (e.key === 'Escape') onDismiss()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onDismiss])

  return (
    <div className={styles.backdrop} onClick={onDismiss}>
      <div
        className={styles.dialog}
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
      >
        <p className={styles.message}>Out of mistakes — game over.</p>
        <div className={styles.actions}>
          <button type="button" className={styles.cancel} onClick={onReset}>
            Reset
          </button>
          <button type="button" className={styles.confirm} onClick={onNewGame}>
            New puzzle
          </button>
        </div>
      </div>
    </div>
  )
}
