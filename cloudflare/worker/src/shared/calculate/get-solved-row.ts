import isValidWordle from './is-valid-wordle';
import { SCORE } from '../const/SCORE-CONST';

export function getSolvedRow(wordle: number[]): number {
  if (!isValidWordle(wordle)) {
    return 0;
  }
  const lastFiveBlocks = wordle.slice(-5);
  if (lastFiveBlocks.filter((e) => e === SCORE.CORRECT).length !== 5) {
    return 0;
  }
  return wordle.length / 5;
}
