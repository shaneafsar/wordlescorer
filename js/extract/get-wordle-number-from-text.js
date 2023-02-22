/**
 * Get the wordle number using regex from a text string. For example
 * if given a string Wordle 456 5/6, return 456.
 * @param {String} text - input text to convert to wordle number
 * @returns {Number}
 */
function getWordleNumberFromText(text = '') {
  let wordle = text.match(/wordle\s*#?\s*(\d+)/i);
  if(wordle === null || wordle.length < 2) {
      return 0;
  }
  //convert wordle[1] to number
  return parseInt(wordle?.[1] || '0');
}

/**
 * Same as getWordleNumberFromText, but returns the first valid result
 * @param {string[]} list 
 * @returns {Number}
 */
function getWordleNumberFromList(list) {
  for (const item of list) {
    const output = getWordleNumberFromText(item);
    if(output !== 0) {
      return output;
    }
  }
  return 0;
}

export { getWordleNumberFromText, getWordleNumberFromList };