/**
 * Check if the Wordle post indicates hard mode.
 * It ensures that the input contains a valid Wordle result format and checks for the presence of "*" at the end.
 *
 * @param {string} text - The input text containing the Wordle result.
 * @returns {boolean} True if hard mode is indicated for the matched Wordle result, otherwise false.
 */
function isWordleHardMode(text: string = ''): boolean {
  // Regex to match a valid Wordle result format and check for "*"
  const match = text.match(/wordle\s*#?\s*\d+(?:[,\.\s]\d{3})?\s*\d+\/\d+\s*(\*)?/i);

  // If there's a match, check if the hard mode indicator "*" is present
  if (match) {
    return !!match[1]; // The capture group (1) will be "*" if hard mode is indicated
  }

  // Return false if no valid Wordle format is found
  return false;
}

/*
// Example usage
const example1 = "Here is my score: Wordle 1,249 6/6*";
const example2 = "I played Wordle 1,249 6/6 today.";
const example3 = "Some text Wordle 999 4/6* more text";

console.log(isWordleHardMode(example1)); // Output: true
console.log(isWordleHardMode(example2)); // Output: false
console.log(isWordleHardMode(example3)); // Output: true
*/

/**
 * Check if any string in the list indicates Wordle hard mode.
 * Returns true for the first string that matches the hard mode format.
 *
 * @param {string[]} list - An array of strings to search for hard mode.
 * @returns {boolean} True if hard mode is found in any of the strings, otherwise false.
 */
function isWordleHardModeFromList(list: string[]): boolean {
  for (const item of list) {
    if (isWordleHardMode(item)) {
      return true; // Return true as soon as hard mode is found
    }
  }
  return false; // Return false if no hard mode is found
}

export { isWordleHardMode, isWordleHardModeFromList };