'use client'
import { useEffect, useMemo, useRef } from 'react'
import { winVariant } from './lib/winVariants'
import styles from './WinOverlay.module.css'

// Confetti palettes per celebration tier. All anchor on the champagne golds;
// hard goes all-gold (the richest rain), custom weaves in the entry-ink blue
// to nod at the player's own digits.
const PALETTES = {
  easy: ['#d6b36a', '#e8cd89', '#a8bcff', '#74c993', '#fdf6e4'],
  medium: ['#d6b36a', '#e8cd89', '#b08a3c', '#a8bcff', '#74c993', '#fdf6e4'],
  hard: ['#d6b36a', '#e8cd89', '#b08a3c', '#f2e3bd', '#fdf6e4', '#8a6a24'],
  custom: ['#d6b36a', '#e8cd89', '#a8bcff', '#2f56a8', '#fdf6e4', '#74c993'],
}

// Full-screen celebration shown once a puzzle is solved. Deliberately staged:
// the board's golden wave plays first, then the glass backdrop fades in, the
// title rises with a shimmer, confetti rains, and finally the actions appear.
// All timing lives in the CSS module; what is said and how rich the fanfare is
// comes from winVariant (difficulty tier, flawless accolade, streak). Escape
// or a backdrop click dismisses it, leaving the solved board on display.
export default function WinOverlay({ category, mistakeCount, streak, onNewGame, onDismiss }) {
  const newGameRef = useRef(null)
  const variant = winVariant({ category, mistakeCount, streak })

  useEffect(() => {
    function onKey(e) {
      if (e.key === 'Escape') onDismiss()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onDismiss])

  // Move focus into the dialog so Enter starts the next puzzle.
  useEffect(() => {
    newGameRef.current?.focus()
  }, [])

  // Random spread is fine here: the overlay only mounts client-side, after a
  // solve, and the pieces are memoized for its lifetime.
  const pieces = useMemo(() => {
    const colors = PALETTES[variant.tier] ?? PALETTES.medium
    return Array.from({ length: variant.pieces }, (_, i) => ({
      x: `${Math.random() * 100}%`,
      delay: `${1.6 + Math.random() * 1.6}s`,
      duration: `${2.8 + Math.random() * 2.4}s`,
      rotate: `${360 + Math.random() * 540}deg`,
      scale: 0.5 + Math.random() * 0.9,
      color: colors[i % colors.length],
    }))
  }, [variant.tier, variant.pieces])

  const hasAccolades = variant.flawless || variant.streakLine

  return (
    <div className={styles.backdrop} data-tier={variant.tier} onClick={onDismiss}>
      <div className={styles.confetti} aria-hidden="true">
        {pieces.map((p, i) => (
          <span
            key={i}
            className={styles.piece}
            style={{
              '--x': p.x,
              '--delay': p.delay,
              '--duration': p.duration,
              '--rotate': p.rotate,
              '--scale': p.scale,
              '--color': p.color,
            }}
          />
        ))}
      </div>
      <div
        className={styles.panel}
        data-tier={variant.tier}
        role="dialog"
        aria-modal="true"
        aria-label="Puzzle solved"
        onClick={(e) => e.stopPropagation()}
      >
        <p className={styles.kicker}>{variant.kicker}</p>
        <h2 className={styles.title}>{variant.title}</h2>
        <p className={styles.subtitle}>{variant.summary}</p>
        {hasAccolades && (
          <div className={styles.accolades}>
            {variant.flawless && <span className={styles.accolade}>✦ Flawless</span>}
            {variant.streakLine && <span className={styles.accolade}>❖ {variant.streakLine}</span>}
          </div>
        )}
        <div className={styles.actions}>
          <button type="button" className={styles.ghost} onClick={onDismiss}>
            Admire the board
          </button>
          <button type="button" className={styles.primary} ref={newGameRef} onClick={onNewGame}>
            New puzzle
          </button>
        </div>
      </div>
    </div>
  )
}
