import getMultiplier from './get-multiplier.js';
import { SCORE } from '../const/SCORE-CONST.js';

/**
 * Provides a bonus per square based on where the wordle was solved.
 * @param {Number} solvedRow - row number where a solve occured (must be between 1-6)
 * @returns {Number} integer bonus amount
 */
export function getPointBonus(solvedRow, isHardMode = false) {
  var bonus = 0;
  var blocksPerRow = 5;
  var solvedBlockValue = SCORE.CORRECT;
  var i = solvedRow;
  for (; i <= 5; i++) {
    bonus += solvedBlockValue * blocksPerRow * (getMultiplier((solvedRow * 5) - 1) + (isHardMode ? 1 : 0));
  }
  return bonus;
}
