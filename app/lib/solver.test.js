import { describe, it, expect } from 'vitest';
import { solve, countSolutions } from './solver';

// A known-solvable puzzle (easy), 81-char string with 0 for blanks.
const PUZZLE =
  '530070000600195000098000060800060003400803001700020006060000280000419005000080079';
const SOLUTION =
  '534678912672195348198342567859761423426853791713924856961537284287419635345286179';

function toArr(s) {
  return s.split('').map(Number);
}

describe('solve', () => {
  it('solves a valid puzzle to the known solution', () => {
    expect(solve(toArr(PUZZLE))).toEqual(toArr(SOLUTION));
  });

  it('returns null for an unsolvable puzzle', () => {
    const bad = toArr(PUZZLE);
    bad[1] = 5; // duplicate 5 in row 0 / column conflict
    expect(solve(bad)).toBeNull();
  });

  it('does not mutate the input array', () => {
    const input = toArr(PUZZLE);
    const copy = input.slice();
    solve(input);
    expect(input).toEqual(copy);
  });
});

describe('countSolutions', () => {
  it('returns 1 for a puzzle with a unique solution', () => {
    expect(countSolutions(toArr(PUZZLE))).toBe(1);
  });

  it('caps the count at 2 by default', () => {
    // empty board has many solutions; capped at 2
    expect(countSolutions(new Array(81).fill(0))).toBe(2);
  });

  it('returns 0 for an unsolvable puzzle', () => {
    const bad = toArr(PUZZLE);
    bad[1] = 5;
    expect(countSolutions(bad)).toBe(0);
  });
});
