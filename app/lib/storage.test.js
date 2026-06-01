import { describe, it, expect, beforeEach, vi } from 'vitest';
import { saveGame, loadGame, clearGame, STORAGE_VERSION } from './storage';

const KEY = 'sudoku-cloud:savegame';

function makeStore() {
  let store = {};
  return {
    getItem: (k) => (k in store ? store[k] : null),
    setItem: (k, v) => {
      store[k] = String(v);
    },
    removeItem: (k) => {
      delete store[k];
    },
    clear: () => {
      store = {};
    },
  };
}

describe('storage v2', () => {
  beforeEach(() => {
    vi.stubGlobal('localStorage', makeStore());
  });

  it('round-trips board, solution, and difficulty', () => {
    const board = new Array(81).fill(0);
    const solution = new Array(81).fill(1);
    saveGame({ board, solution, difficulty: 'hard' });
    const loaded = loadGame();
    expect(loaded.board).toEqual(board);
    expect(loaded.solution).toEqual(solution);
    expect(loaded.difficulty).toBe('hard');
  });

  it('returns null when nothing saved', () => {
    expect(loadGame()).toBeNull();
  });

  it('ignores saves from an older version', () => {
    localStorage.setItem(
      KEY,
      JSON.stringify({ version: 1, board: new Array(81).fill(0) })
    );
    expect(loadGame()).toBeNull();
  });

  it('clears a saved game', () => {
    saveGame({ board: new Array(81).fill(0), solution: new Array(81).fill(1), difficulty: 'easy' });
    clearGame();
    expect(loadGame()).toBeNull();
  });

  it('exposes STORAGE_VERSION = 2', () => {
    expect(STORAGE_VERSION).toBe(2);
  });
});
