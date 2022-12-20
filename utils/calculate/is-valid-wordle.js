/**
 * 
 * @param {Number[]} wordle array of numbers representing scores for each square
 * @returns {Boolean} true if array is a valid Wordle game
 */
function isValidWordle(wordle) {
  if (wordle.length === 0 || wordle.length % 5 !== 0) {
    return false;
  }
  return true;
}

export default isValidWordle;