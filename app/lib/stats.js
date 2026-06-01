// Pure stats logic: record shape, badge rules, and recordSolve. No React, no
// localStorage. The only clock access is todayLocal(); everything else takes an
// explicit date so it is deterministically testable.

export const STATS_VERSION = 1

export function defaultStats() {
  return {
    version: STATS_VERSION,
    solved: { total: 0, easy: 0, medium: 0, hard: 0, custom: 0 },
    streak: { current: 0, best: 0, lastSolveDate: null },
    daily: { date: null, count: 0 },
    badges: [],
  }
}

function formatLocal(d) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

// Local date as 'YYYY-MM-DD'.
export function todayLocal() {
  return formatLocal(new Date())
}

// The calendar day before dateStr ('YYYY-MM-DD'), without timezone drift.
// Build the date at local noon so a DST transition can't shift the day.
export function yesterday(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number)
  const dt = new Date(y, m - 1, d, 12, 0, 0)
  dt.setDate(dt.getDate() - 1)
  return formatLocal(dt)
}

export const BADGES = [
  { id: 'solve-10', kind: 'total', threshold: 10, label: 'Solved 10 puzzles' },
  { id: 'solve-50', kind: 'total', threshold: 50, label: 'Solved 50 puzzles' },
  { id: 'solve-75', kind: 'total', threshold: 75, label: 'Solved 75 puzzles' },
  { id: 'solve-100', kind: 'total', threshold: 100, label: 'Solved 100 puzzles' },
  { id: 'solve-150', kind: 'total', threshold: 150, label: 'Solved 150 puzzles' },
  { id: 'solve-200', kind: 'total', threshold: 200, label: 'Solved 200 puzzles' },
  { id: 'day-2', kind: 'day', threshold: 2, label: '2 puzzles in a day' },
  { id: 'day-5', kind: 'day', threshold: 5, label: '5 puzzles in a day' },
  { id: 'day-8', kind: 'day', threshold: 8, label: '8 puzzles in a day' },
  { id: 'day-10', kind: 'day', threshold: 10, label: '10 puzzles in a day' },
]

// Record one solve. Returns a NEW stats object plus any badges newly earned by
// this solve (empty when none). `date` is a local 'YYYY-MM-DD' string supplied
// by the caller. `category` is one of easy|medium|hard|custom.
export function recordSolve(stats, { category, date }) {
  const next = {
    version: STATS_VERSION,
    solved: { ...stats.solved },
    streak: { ...stats.streak },
    daily: { ...stats.daily },
    badges: [...stats.badges],
  }

  // Counts.
  next.solved.total += 1
  next.solved[category] += 1

  // Streak: unchanged if already solved today; +1 if yesterday was the last
  // solve; otherwise restart at 1.
  if (next.streak.lastSolveDate === date) {
    // already solved today — leave current as is
  } else if (next.streak.lastSolveDate === yesterday(date)) {
    next.streak.current += 1
  } else {
    next.streak.current = 1
  }
  next.streak.best = Math.max(next.streak.best, next.streak.current)
  next.streak.lastSolveDate = date

  // Daily count for the current calendar day.
  if (next.daily.date === date) {
    next.daily.count += 1
  } else {
    next.daily = { date, count: 1 }
  }

  // Newly earned badges (against the post-increment totals).
  const earned = new Set(next.badges)
  const newBadges = []
  for (const badge of BADGES) {
    if (earned.has(badge.id)) continue
    const met =
      badge.kind === 'total'
        ? badge.threshold <= next.solved.total
        : badge.threshold <= next.daily.count
    if (met) {
      next.badges.push(badge.id)
      newBadges.push(badge)
    }
  }

  return { stats: next, newBadges }
}
