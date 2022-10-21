function isValidWordle(wordle) {
  if (wordle.length === 0 || wordle.length % 5 !== 0) {
    return false;
  }
  return true;
}

export default isValidWordle;