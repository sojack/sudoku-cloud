'use client'
import { useState } from 'react'
import { useAuth } from './AuthProvider'
import styles from './AccountMenu.module.css'

// `syncStatus` is one of 'synced' | 'syncing' | 'offline' | null, passed down
// from Game once sync is wired in (Task 10).
export default function AccountMenu({ syncStatus = null }) {
  const auth = useAuth()
  const [open, setOpen] = useState(false)
  const [mode, setMode] = useState('signin') // 'signin' | 'signup'
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [message, setMessage] = useState(null)
  const [busy, setBusy] = useState(false)

  if (!auth || !auth.configured) return null
  if (!auth.ready) return null

  async function handleSubmit(e) {
    e.preventDefault()
    setBusy(true)
    setMessage(null)
    const action = mode === 'signup' ? auth.signUp : auth.signIn
    const { error } = await action(email, password)
    setBusy(false)
    if (error) {
      setMessage(error.message)
      return
    }
    if (mode === 'signup') {
      setMessage('Check your email to confirm your account.')
    } else {
      setOpen(false)
      setEmail('')
      setPassword('')
    }
  }

  async function handleForgotPassword() {
    if (!email) {
      setMessage('Enter your email first, then tap reset.')
      return
    }
    setBusy(true)
    setMessage(null)
    const { error } = await auth.resetPassword(email)
    setBusy(false)
    setMessage(error ? error.message : 'Password reset email sent.')
  }

  if (auth.user) {
    return (
      <div className={styles.account}>
        <span className={`${styles.dot} ${styles[syncStatus] ?? ''}`} title={syncStatus ?? ''} />
        <span className={styles.email}>{auth.user.email}</span>
        <button className={styles.link} onClick={() => auth.signOut().catch(() => {})}>
          Sign out
        </button>
      </div>
    )
  }

  return (
    <div className={styles.account}>
      {!open && (
        <button className={styles.link} onClick={() => setOpen(true)}>
          Sign in to sync
        </button>
      )}
      {open && (
        <form className={styles.form} onSubmit={handleSubmit}>
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={6}
          />
          <button type="submit" disabled={busy}>
            {mode === 'signup' ? 'Sign up' : 'Sign in'}
          </button>
          <button
            type="button"
            className={styles.link}
            onClick={() => setMode(mode === 'signup' ? 'signin' : 'signup')}
          >
            {mode === 'signup' ? 'Have an account? Sign in' : 'New? Create an account'}
          </button>
          {mode === 'signin' && (
            <button
              type="button"
              className={styles.link}
              onClick={handleForgotPassword}
              disabled={busy}
            >
              Forgot password?
            </button>
          )}
          {message && <p className={styles.message}>{message}</p>}
        </form>
      )}
    </div>
  )
}
