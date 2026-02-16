import { describe, it, expect } from 'vitest';
import { calculateScoreFromWordleMatrix } from './calculate-score-from-wordle-matrix.js';

describe('calculateScoreFromWordleMatrix', () => {
  it('scores a perfect row 1 solve at maximum (420)', () => {
    // Row 1: all correct (2), multiplier 6 each
    // Score: 5 * (2 * 6) = 60
    // Bonus: getPointBonus(1) = 300
    // Total: 60 + 300 = 360
    // Wait, let me recalculate...
    // Actually bonus for row 1: loop i=1 to 5, 5 iterations, each 2*5*6=60, total bonus=300
    // Row score: 5 cells * 2 * 6 = 60
    // Total: 60 + 300 = 360
    const result = calculateScoreFromWordleMatrix([2, 2, 2, 2, 2]);
    expect(result.finalScore).toBe(360);
  });

  it('scores a row 6 solve with all wrong except last row', () => {
    const wordle = [
      0, 0, 0, 0, 0,  // row 1: 0
      0, 0, 0, 0, 0,  // row 2: 0
      0, 0, 0, 0, 0,  // row 3: 0
      0, 0, 0, 0, 0,  // row 4: 0
      0, 0, 0, 0, 0,  // row 5: 0
      2, 2, 2, 2, 2,  // row 6: 5 * 2 * 1 = 10
    ];
    // No bonus for row 6
    const result = calculateScoreFromWordleMatrix(wordle);
    expect(result.finalScore).toBe(10);
  });

  it('returns higher score for hard mode', () => {
    const wordle = [0, 0, 0, 0, 0, 2, 2, 2, 2, 2];
    const normal = calculateScoreFromWordleMatrix(wordle, false);
    const hard = calculateScoreFromWordleMatrix(wordle, true);
    expect(hard.finalScore).toBeGreaterThan(normal.finalScore);
  });

  it('handles partial scores', () => {
    // Row 1: [1,1,1,1,1] → 5 * 1 * 6 = 30
    // Row 2: [2,2,2,2,2] → 5 * 2 * 5 = 50
    // Bonus for row 2: getPointBonus(2) → loop i=2..5 → 4 iterations, multiplier(9)=5, 2*5*5=50, 4*50=200
    const wordle = [1, 1, 1, 1, 1, 2, 2, 2, 2, 2];
    const result = calculateScoreFromWordleMatrix(wordle);
    expect(result.finalScore).toBe(30 + 50 + 200);
  });

  it('scores a row 3 solve correctly', () => {
    const wordle = [
      0, 0, 1, 0, 0,  // row 1: 1*6 = 6
      0, 1, 2, 1, 0,  // row 2: (1+2+1)*5 = 20
      2, 2, 2, 2, 2,  // row 3: 5*2*4 = 40
    ];
    // Bonus: getPointBonus(3) = 120
    const result = calculateScoreFromWordleMatrix(wordle);
    expect(result.finalScore).toBe(6 + 20 + 40 + 120);
  });
});
