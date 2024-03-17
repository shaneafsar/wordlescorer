/**
 * Get the Wordle number from a text string, accurately extracting numbers formatted with spaces, commas, or dots as thousand separators,
 * or presented without any separators. It first checks for numbers formatted with spaces, then for numbers with period or comma separators,
 * and finally defaults to normal extraction for numbers without any separators. This approach ensures compatibility with formats like "1 005",
 * "1.005", "1,005", "1001", and "456".
 * @param {String} text - The input text containing the Wordle number.
 * @returns {Number} The parsed Wordle number as an integer, or 0 if no valid number is found.
 */
function getWordleNumberFromText(text = '') {
  // Step 1: Check for space separator
  let match = text.match(/wordle\s*#?\s*(\d{1,3}\s\d{3})/i);
  if (match) {
    return parseInt(match[1].replace(/\s/g, ''), 10);
  }

  // Step 2: Check for period or comma separator
  match = text.match(/wordle\s*#?\s*(\d{1,3}[,\.]\d{3})/i);
  if (match) {
    return parseInt(match[1].replace(/[,\s.]/g, ''), 10);
  }

  // Step 3: Normal extraction for numbers without any thousand separators
  match = text.match(/wordle\s*#?\s*(\d+)/i);
  if (match) {
    return parseInt(match[1], 10);
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