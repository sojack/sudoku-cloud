import { defaultStats, STATS_VERSION } from './stats'

const KEY = 'sudoku-cloud:stats'

export function loadStats() {
  if (typeof localStorage === 'undefined') return defaultStats()
  const raw = localStorage.getItem(KEY)
  if (!raw) return defaultStats()
  try {
    const data = JSON.parse(raw)
    if (data.version !== STATS_VERSION) return defaultStats()
    return data
  } catch {
    return defaultStats()
  }
}

export function saveStats(stats) {
  if (typeof localStorage === 'undefined') return
  localStorage.setItem(KEY, JSON.stringify(stats))
}

export function clearStats() {
  if (typeof localStorage === 'undefined') return
  localStorage.removeItem(KEY)
}
