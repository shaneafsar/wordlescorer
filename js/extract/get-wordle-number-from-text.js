/**
 * Get the Wordle number using regex from a text string. This function first checks if the Wordle number includes
 * a comma or period (formatted as "1,001" or "1.001") as thousands separators. If no comma or period is present,
 * it attempts to extract a regular number. It supports extracting Wordle numbers both with and without comma or
 * period formatting. For example, if given a string "Wordle 1,001 5/6" or "Wordle 1.001 5/6", it returns 1001.
 * If given "Wordle 456 5/6", it returns 456.
 * @param {String} text - input text to convert to wordle number
 * @returns {Number}
 */
function getWordleNumberFromText(text = '') {
  // Try to match a number with commas or periods as thousands separators
  let wordleFormatted = text.match(/wordle\s*#?\s*(\d{1,3}(?:[,.]\d{3})+)/i);
  if(wordleFormatted && wordleFormatted.length >= 2) {
    // If a formatted number is found, remove commas or periods and convert to number
    let numberWithoutSeparators = wordleFormatted[1].replace(/[,.]/g, '');
    return parseInt(numberWithoutSeparators);
  }

  // If no formatted number is found, try to match any sequence of digits
  let wordleWithoutFormatting = text.match(/wordle\s*#?\s*(\d+)/i);
  if(wordleWithoutFormatting && wordleWithoutFormatting.length >= 2) {
    // Convert found number to integer
    return parseInt(wordleWithoutFormatting[1]);
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