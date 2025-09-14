function isValidWordle(wordle: number[], wordleNumber?: number, solvedRow?: number): boolean {
  if (wordle.length === 0 || wordle.length % 5 !== 0) {
    return false;
  }

  if (wordleNumber === 0) {
    return false;
  }

  if (typeof solvedRow !== 'undefined' && Number.isInteger(solvedRow)) {
    return solvedRow < 7;
  }
  return true;
}

export default isValidWordle;