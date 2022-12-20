/**
 * Get the wordle number using regex from a text string. For example
 * if given a string Wordle 456 5/6, return 456.
 * @param {String} text - input text to convert to wordle number
 * @returns {Number}
 */
function getWordleNumberFromText(text = '') {
  var wordle = text.match(/(?<=Wordle )(\d+)/g);
  if(wordle === null) {
    return 0;
  }
  //convert wordle[0] to number
  return parseInt(wordle[0]);
}

export default getWordleNumberFromText;