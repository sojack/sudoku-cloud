'use client'
import { useEffect, useState } from 'react'
import { THEME_KEY, resolveStoredTheme, nextTheme } from './lib/theme'
import styles from './page.module.css'

// Light/dark toggle. Reflects the resolved theme and persists the choice.
export default function ThemeToggle() {
  const [theme, setTheme] = useState('light')

  // On mount, read the resolved theme: explicit data-theme, else stored, else
  // the OS preference. (The pre-paint script in layout.js may have set it.)
  useEffect(() => {
    const attr = document.documentElement.dataset.theme
    const stored = resolveStoredTheme(
      typeof localStorage !== 'undefined' ? localStorage.getItem(THEME_KEY) : null
    )
    const osDark =
      typeof window !== 'undefined' &&
      window.matchMedia &&
      window.matchMedia('(prefers-color-scheme: dark)').matches
    setTheme(attr || stored || (osDark ? 'dark' : 'light'))
  }, [])

  function toggle() {
    const next = nextTheme(theme)
    document.documentElement.dataset.theme = next
    try {
      localStorage.setItem(THEME_KEY, next)
    } catch {
      // storage unavailable — ignore; the attribute still applies for this session
    }
    setTheme(next)
  }

  return (
    <button
      type="button"
      className={styles.themeToggle}
      onClick={toggle}
      aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
    >
      {theme === 'dark' ? '☀' : '☾'}
    </button>
  )
}
