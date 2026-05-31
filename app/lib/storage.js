// Versioned localStorage persistence for the in-progress game.

export const STORAGE_KEY = 'sudoku-cloud:game'
export const STORAGE_VERSION = 1

export function saveGame({ board, puzzleId }, storage = globalThis.localStorage) {
  if (!storage) return
  try {
    storage.setItem(
      STORAGE_KEY,
      JSON.stringify({ version: STORAGE_VERSION, board, puzzleId })
    )
  } catch {
    // storage unavailable or full — ignore
  }
}

export function loadGame(storage = globalThis.localStorage) {
  if (!storage) return null
  const raw = storage.getItem(STORAGE_KEY)
  if (raw == null) return null
  let parsed
  try {
    parsed = JSON.parse(raw)
  } catch {
    return null
  }
  if (!parsed || parsed.version !== STORAGE_VERSION) return null
  return { board: parsed.board, puzzleId: parsed.puzzleId }
}
