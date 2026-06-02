const KEY = 'sudoku-cloud:savegame';
export const STORAGE_VERSION = 3;

export function saveGame({ board, solution, difficulty, category, recorded }) {
  if (typeof localStorage === 'undefined') return;
  const payload = JSON.stringify({
    version: STORAGE_VERSION,
    board,
    solution,
    difficulty,
    category,
    recorded,
    savedAt: Date.now(),
  });
  localStorage.setItem(KEY, payload);
}

export function loadGame() {
  if (typeof localStorage === 'undefined') return null;
  const raw = localStorage.getItem(KEY);
  if (!raw) return null;
  try {
    const data = JSON.parse(raw);
    if (data.version !== STORAGE_VERSION) return null;
    return {
      board: data.board,
      solution: data.solution,
      difficulty: data.difficulty,
      category: data.category ?? data.difficulty ?? null,
      recorded: data.recorded ?? false,
      savedAt: data.savedAt ?? 0,
    };
  } catch {
    return null;
  }
}

export function clearGame() {
  if (typeof localStorage === 'undefined') return;
  localStorage.removeItem(KEY);
}
