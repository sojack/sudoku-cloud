import { countSolutions } from './solver';

export const DIFFICULTIES = [
  { key: 'easy', label: 'Easy', clues: 36 },
  { key: 'medium', label: 'Medium', clues: 30 },
  { key: 'hard', label: 'Hard', clues: 26 },
];

function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// A complete, valid, randomized grid via backtracking with shuffled candidates.
function randomFullGrid() {
  const g = Array(81).fill(0);
  function canPlace(i, v) {
    const r = Math.floor(i / 9);
    const c = i % 9;
    const br = Math.floor(r / 3) * 3;
    const bc = Math.floor(c / 3) * 3;
    for (let k = 0; k < 9; k++) {
      if (g[r * 9 + k] === v) return false;
      if (g[k * 9 + c] === v) return false;
      if (g[(br + Math.floor(k / 3)) * 9 + (bc + (k % 3))] === v) return false;
    }
    return true;
  }
  function rec(pos) {
    if (pos === 81) return true;
    for (const v of shuffle([1, 2, 3, 4, 5, 6, 7, 8, 9])) {
      if (canPlace(pos, v)) {
        g[pos] = v;
        if (rec(pos + 1)) return true;
        g[pos] = 0;
      }
    }
    return false;
  }
  rec(0);
  return g;
}

export function generate(difficultyKey) {
  const level =
    DIFFICULTIES.find((d) => d.key === difficultyKey) ||
    DIFFICULTIES.find((d) => d.key === 'medium');
  const target = level.clues;
  const solution = randomFullGrid();
  const givens = solution.slice();
  // Dig in random order while keeping a unique solution + above target.
  const order = shuffle([...Array(81).keys()]);
  let clues = 81;
  for (const idx of order) {
    if (clues <= target) break;
    const backup = givens[idx];
    givens[idx] = 0;
    if (countSolutions(givens) === 1) {
      clues--;
    } else {
      givens[idx] = backup;
    }
  }
  return { givens, solution, difficulty: level.key };
}
