// Theme persistence helpers. The active theme is reflected as
// document.documentElement.dataset.theme ('light' | 'dark'); absent = follow OS.

export const THEME_KEY = 'sudoku-cloud:theme'

// A stored theme value is only valid if it is exactly 'light' or 'dark'.
// Anything else (absent, empty, unknown) means "follow the OS preference".
export function resolveStoredTheme(raw) {
  return raw === 'light' || raw === 'dark' ? raw : null
}

export function nextTheme(current) {
  return current === 'dark' ? 'light' : 'dark'
}
