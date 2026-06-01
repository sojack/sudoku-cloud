import { solve, countSolutions } from './solver';

export const DIFFICULTIES = {
  easy: { clues: 36 },
  medium: { clues: 30 },
  hard: { clues: 26 },
};

function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// Produce a random complete solution by solving an empty board with
// randomized first-row seeding.
function randomSolution() {
  const board = new Array(81).fill(0);
  // Seed the first row with a shuffled permutation to randomize the solve.
  const firstRow = shuffle([1, 2, 3, 4, 5, 6, 7, 8, 9]);
  for (let c = 0; c < 9; c++) board[c] = firstRow[c];
  return solve(board);
}

export function generate(difficultyKey) {
  const difficulty = DIFFICULTIES[difficultyKey] ? difficultyKey : 'medium';
  const target = DIFFICULTIES[difficulty].clues;
  const solution = randomSolution();
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
  return { givens, solution, difficulty };
}
