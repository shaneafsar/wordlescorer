/**
 * Get the wordle number using regex from a text string. This function first checks if the Wordle number includes
 * a comma (formatted as "1,001"). If no comma is present, it attempts to extract a regular number.
 * It supports extracting Wordle numbers both with and without comma formatting.
 * For example, if given a string "Wordle 1,001 5/6", it returns 1001. If given "Wordle 456 5/6", it returns 456.
 * @param {String} text - input text to convert to wordle number
 * @returns {Number}
 */
function getWordleNumberFromText(text = '') {
  // First try to match a number with commas
  let wordleWithComma = text.match(/wordle\s*#?\s*(\d{1,3}(?:,\d{3})+)/i);
  if(wordleWithComma && wordleWithComma.length >= 2) {
    // If a comma-inclusive number is found, remove commas and convert to number
    let numberWithoutCommas = wordleWithComma[1].replace(/,/g, '');
    return parseInt(numberWithoutCommas);
  }

  // If no comma-inclusive number is found, try to match any number
  let wordleWithoutComma = text.match(/wordle\s*#?\s*(\d+)/i);
  if(wordleWithoutComma && wordleWithoutComma.length >= 2) {
    // Convert found number to integer
    return parseInt(wordleWithoutComma[1]);
  }

  // Return 0 if no matching number is found
  return 0;
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