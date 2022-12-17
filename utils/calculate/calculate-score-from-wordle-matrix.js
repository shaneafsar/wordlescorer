import getMultiplier from './get-multiplier.js';
import { getPointBonus } from './get-point-bonus.js';

/**
 * Calculate score
 * @param {Number[]} wordle - array of numbers representing scores for each square
 * @returns {Object} {finalScore: number}
 */
export function calculateScoreFromWordleMatrix(wordle) {
  var solvedRowBonus = getPointBonus(wordle.length / 5);
  var score = wordle.map((element, index) => {
    return element * getMultiplier(index);
  }).reduce((previous, current) => {
    return previous + current;
  });
  return { finalScore: score + solvedRowBonus };
}
