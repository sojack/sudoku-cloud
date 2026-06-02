import { BADGES } from './stats'

// Merge two stats records non-destructively. The conflict rule: max each
// solved category (total derived from them), union + re-derive badges, take the
// later-dated streak/daily. Pure: no I/O, no clock. Commutative, idempotent,
// and monotonic on cumulative fields by construction.
export function mergeStats(a, b) {
  if (!a) return b
  if (!b) return a
  // Never blend mismatched shapes — return the higher-version object untouched.
  if (a.version !== b.version) return a.version > b.version ? a : b

  const solved = {
    easy: Math.max(a.solved.easy, b.solved.easy),
    medium: Math.max(a.solved.medium, b.solved.medium),
    hard: Math.max(a.solved.hard, b.solved.hard),
    custom: Math.max(a.solved.custom, b.solved.custom),
  }
  solved.total = solved.easy + solved.medium + solved.hard + solved.custom

  const streak = mergeStreak(a.streak, b.streak)
  const daily = mergeDaily(a.daily, b.daily)
  const badges = mergeBadges(a.badges, b.badges, solved.total, daily.count)

  return { version: a.version, solved, streak, daily, badges }
}

// Later lastSolveDate is authoritative for `current`; equal dates take the max
// current. `best` is the max across both plus the chosen current. Null dates
// sort earliest.
function mergeStreak(a, b) {
  const ad = a.lastSolveDate ?? ''
  const bd = b.lastSolveDate ?? ''
  let current
  let lastSolveDate
  if (ad === bd) {
    current = Math.max(a.current, b.current)
    lastSolveDate = a.lastSolveDate
  } else if (ad > bd) {
    current = a.current
    lastSolveDate = a.lastSolveDate
  } else {
    current = b.current
    lastSolveDate = b.lastSolveDate
  }
  return { current, best: Math.max(a.best, b.best, current), lastSolveDate }
}

// Daily count belongs to a calendar day: later date wins; equal date maxes.
function mergeDaily(a, b) {
  const ad = a.date ?? ''
  const bd = b.date ?? ''
  if (ad === bd) return { date: a.date, count: Math.max(a.count, b.count) }
  return ad > bd ? { ...a } : { ...b }
}

// Union of earned badges, plus any badge whose threshold the merged totals now
// cross. Output follows BADGES order for deterministic, stable results.
function mergeBadges(a, b, total, dailyCount) {
  const earned = new Set([...a, ...b])
  for (const badge of BADGES) {
    if (earned.has(badge.id)) continue
    const met =
      badge.kind === 'total' ? badge.threshold <= total : badge.threshold <= dailyCount
    if (met) earned.add(badge.id)
  }
  return BADGES.filter((badge) => earned.has(badge.id)).map((badge) => badge.id)
}
