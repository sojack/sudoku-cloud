// Classify a hand-entered puzzle by solution count, reusing the solver.
// givens is a flat 81-entry array with 0 for empty.

import { solve, countSolutions } from './solver'

export function validatePuzzle(givens) {
  const n = countSolutions(givens, 2)
  if (n === 0) return { status: 'none' }
  if (n >= 2) return { status: 'multiple' }
  return { status: 'unique', solution: solve(givens) }
}
