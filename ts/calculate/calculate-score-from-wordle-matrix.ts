import getMultiplier from './get-multiplier.js';
import { getPointBonus } from './get-point-bonus.js';

interface CalcResult {
  finalScore: number;
}

export function calculateScoreFromWordleMatrix(wordle: number[], isHardMode: boolean = false): CalcResult {
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