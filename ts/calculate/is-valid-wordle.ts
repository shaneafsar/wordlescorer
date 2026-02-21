// Wordle #1 = June 19, 2021
const WORDLE_EPOCH = new Date('2021-06-19T00:00:00Z').getTime();
const MS_PER_DAY = 86400000;
const WINDOW = 7; // ±7 days tolerance

function getExpectedWordleNumber(): number {
  return Math.floor((Date.now() - WORDLE_EPOCH) / MS_PER_DAY) + 1;
}

function isValidWordle(wordle: number[], wordleNumber?: number, solvedRow?: number): boolean {
  if (wordle.length === 0 || wordle.length % 5 !== 0) {
    return false;
  }

  if (wordleNumber === 0) {
    return false;
  }

  if (typeof wordleNumber === 'number') {
    const expected = getExpectedWordleNumber();
    if (Math.abs(wordleNumber - expected) > WINDOW) {
      return false;
    }
  }

  if (typeof solvedRow !== 'undefined' && Number.isInteger(solvedRow)) {
    return solvedRow < 7;
  }
  return true;
}

export default isValidWordle;
