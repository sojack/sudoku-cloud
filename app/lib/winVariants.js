// Pure celebration-variant logic for the win overlay: which tier of fanfare a
// solve earns and the copy that goes with it. No React, no DOM — the overlay
// turns the returned descriptor into styling (via data-tier) and text.

const TIERS = {
  easy: {
    tier: 'easy',
    kicker: 'Puzzle complete',
    title: 'Solved.',
    label: 'Easy puzzle',
    pieces: 36,
  },
  medium: {
    tier: 'medium',
    kicker: 'Puzzle complete',
    title: 'Brilliant.',
    label: 'Medium puzzle',
    pieces: 56,
  },
  hard: {
    tier: 'hard',
    kicker: 'Hard, conquered',
    title: 'Masterful.',
    label: 'Hard puzzle',
    pieces: 84,
  },
  custom: {
    tier: 'custom',
    kicker: 'Your own creation',
    title: 'One of a kind.',
    label: 'Custom puzzle',
    pieces: 56,
  },
}

// Build the overlay descriptor for one solve.
//   category     easy|medium|hard|custom (unknown values fall back to medium)
//   mistakeCount mistakes spent on this solve
//   streak       the post-solve stats.streak ({ current, best }) or null/undefined
// Returns { tier, kicker, title, summary, flawless, streakLine, pieces }.
// `streakLine` is null until a streak is worth bragging about (2+ days).
export function winVariant({ category, mistakeCount, streak }) {
  const tier = TIERS[category] ?? TIERS.medium
  const flawless = mistakeCount === 0

  const summary = flawless
    ? `${tier.label} solved without a single mistake.`
    : `${tier.label} solved with ${mistakeCount} mistake${mistakeCount === 1 ? '' : 's'}.`

  const current = streak?.current ?? 0
  const streakLine = current >= 2 ? `${current}-day streak` : null

  return {
    tier: tier.tier,
    kicker: tier.kicker,
    title: tier.title,
    summary,
    flawless,
    streakLine,
    pieces: tier.pieces,
  }
}
