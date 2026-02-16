import { describe, it, expect } from 'vitest';
import { getPointBonus } from './get-point-bonus.js';

describe('getPointBonus', () => {
  it('returns 0 for solving on row 6 (no bonus rows remaining)', () => {
    // solvedRow=6, loop: i starts at 6, 6<=5 is false, so bonus=0
    expect(getPointBonus(6)).toBe(0);
  });

  it('returns positive bonus for solving on row 1', () => {
    const bonus = getPointBonus(1);
    // Row 1 solved: loops i from 1 to 5, that's 5 iterations
    // Each iteration: CORRECT(2) * 5 * (multiplier for index 4 + 0) = 2 * 5 * 6 = 60
    // Total: 5 * 60 = 300
    expect(bonus).toBe(300);
  });

  it('returns bonus for solving on row 3', () => {
    const bonus = getPointBonus(3);
    // Row 3: loops i from 3 to 5, that's 3 iterations
    // multiplier for index (3*5)-1 = 14 → getMultiplier(14) = 4
    // Each: 2 * 5 * 4 = 40
    // Total: 3 * 40 = 120
    expect(bonus).toBe(120);
  });

  it('returns higher bonus in hard mode', () => {
    const normalBonus = getPointBonus(3, false);
    const hardBonus = getPointBonus(3, true);
    expect(hardBonus).toBeGreaterThan(normalBonus);
  });

  it('hard mode adds 1 to multiplier', () => {
    // Row 3 hard mode: multiplier for index 14 is 4, +1 = 5
    // Each: 2 * 5 * 5 = 50, 3 iterations = 150
    expect(getPointBonus(3, true)).toBe(150);
  });
});
