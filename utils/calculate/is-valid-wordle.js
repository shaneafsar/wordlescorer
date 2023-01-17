/**
 * 
 * @param {Number[]} wordle array of numbers representing scores for each square
 * @param {Number} [wordleNumber]
 * @param {Number} [solvedRow]
 * @returns {Boolean} true if array is a valid Wordle game
 */
function isValidWordle(wordle, wordleNumber, solvedRow) {
  
  if (wordle.length === 0 || wordle.length % 5 !== 0) {
    return false;
  }

  if(wordleNumber === 0) {
    return false;
  }

  if(Number.isInteger(solvedRow)) {
    return solvedRow < 7;
  }
  return true;
}

export default isValidWordle;