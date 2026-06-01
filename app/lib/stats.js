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
