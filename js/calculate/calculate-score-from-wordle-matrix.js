import getMultiplier from './get-multiplier.js';
import { getPointBonus } from './get-point-bonus.js';

/**
 * Calculated result from wordle matrix
 * @typedef {Object} CalcResult
 * @property {number} finalScore - final wordle score
 */


/**
 * Calculate score
 * @param {Number[]} wordle - Array of numbers representing scores for each square.
 * @param {boolean} [isHardMode=false] - Optional flag indicating if hard mode is active.
 * @returns {CalcResult}
 */
export function calculateScoreFromWordleMatrix(wordle, isHardMode = false) {
  const solvedRowBonus = getPointBonus(wordle.length / 5, isHardMode);

  // Adjust multiplier if isHardMode is true
  const score = wordle
    .map((element, index) => {
      const multiplier = getMultiplier(index) + (isHardMode ? 1 : 0);
      return element * multiplier;
    })
    .reduce((previous, current) => previous + current, 0);

  return { finalScore: score + solvedRowBonus };
}
