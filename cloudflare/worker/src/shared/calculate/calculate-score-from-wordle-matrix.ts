import getMultiplier from './get-multiplier';
import { getPointBonus } from './get-point-bonus';

interface CalcResult {
  finalScore: number;
}

export function calculateScoreFromWordleMatrix(wordle: number[], isHardMode: boolean = false): CalcResult {
  const solvedRowBonus = getPointBonus(wordle.length / 5, isHardMode);

  const score = wordle
    .map((element, index) => {
      const multiplier = getMultiplier(index) + (isHardMode ? 1 : 0);
      return element * multiplier;
    })
    .reduce((previous, current) => previous + current, 0);

  return { finalScore: score + solvedRowBonus };
}
