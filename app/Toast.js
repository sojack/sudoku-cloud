'use client'
import { useEffect } from 'react'
import styles from './page.module.css'

// One toast that dismisses itself after a few seconds.
function ToastItem({ toast, onDismiss }) {
  useEffect(() => {
    const t = setTimeout(() => onDismiss(toast.id), 4000)
    return () => clearTimeout(t)
  }, [toast.id, onDismiss])
  return <div className={styles.toast}>{toast.text}</div>
}

// A queue of transient messages. Renders nothing when empty. `toasts` is an
// array of { id, text }; `onDismiss(id)` removes one. `onDismiss` must be a
// stable reference (e.g. useCallback) so item timers are not reset on every
// parent render.
export default function Toast({ toasts, onDismiss }) {
  if (!toasts.length) return null
  return (
    <div className={styles.toastContainer}>
      {toasts.map((t) => (
        <ToastItem key={t.id} toast={t} onDismiss={onDismiss} />
      ))}
    </div>
  )
}
