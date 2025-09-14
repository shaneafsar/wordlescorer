import getMultiplier from './get-multiplier.js';
import { SCORE } from '../const/SCORE-CONST.js';

export function getPointBonus(solvedRow: number, isHardMode: boolean = false): number {
  let bonus = 0;
  const blocksPerRow = 5;
  const solvedBlockValue = SCORE.CORRECT;
  let i = solvedRow;
  for (; i <= 5; i++) {
    bonus += solvedBlockValue * blocksPerRow * (getMultiplier((solvedRow * 5) - 1) + (isHardMode ? 1 : 0));
  }
  return bonus;
}