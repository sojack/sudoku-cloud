import { describe, it, expect } from 'vitest';
import { generate, DIFFICULTIES } from './generator';
import { countSolutions } from './solver';

function countClues(board) {
  return board.filter((v) => v !== 0).length;
}

function difficulty(key) {
  return DIFFICULTIES.find((d) => d.key === key);
}

describe('DIFFICULTIES', () => {
  it('defines easy, medium, hard with descending clue counts', () => {
    expect(difficulty('easy').clues).toBeGreaterThan(difficulty('medium').clues);
    expect(difficulty('medium').clues).toBeGreaterThan(difficulty('hard').clues);
  });

  it('gives every entry a non-empty string label', () => {
    for (const d of DIFFICULTIES) {
      expect(typeof d.label).toBe('string');
      expect(d.label.length).toBeGreaterThan(0);
    }
  });
});

describe('generate', () => {
  it('returns givens, solution, and difficulty', () => {
    const { givens, solution, difficulty } = generate('easy');
    expect(givens).toHaveLength(81);
    expect(solution).toHaveLength(81);
    expect(difficulty).toBe('easy');
  });

  it('produces a solution that is actually solved', () => {
    const { solution } = generate('easy');
    // no zeros, and a valid full board verified by countSolutions on the solution
    expect(solution.every((v) => v >= 1 && v <= 9)).toBe(true);
  });

  it('produces givens with a unique solution', () => {
    const { givens } = generate('medium');
    expect(countSolutions(givens)).toBe(1);
  });

  it('produces givens matching the solution', () => {
    const { givens, solution } = generate('easy');
    givens.forEach((v, i) => {
      if (v !== 0) expect(v).toBe(solution[i]);
    });
  });

  it('hits roughly the right clue count for each difficulty', () => {
    const easy = generate('easy');
    const target = difficulty('easy').clues;
    expect(countClues(easy.givens)).toBeGreaterThanOrEqual(target - 2);
    expect(countClues(easy.givens)).toBeLessThanOrEqual(target + 6);
  });

  it('defaults to medium for unknown difficulty', () => {
    const { difficulty } = generate('nonsense');
    expect(difficulty).toBe('medium');
  });
});
