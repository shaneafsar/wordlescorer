import { CODEPOINT_SCORE } from '../const/SCORE-CONST.js';

/**
 * Convert text to a flattened array representing scores for each square.
 * @param {String} text - input text to conver to wordle score array
 * @returns {Number[]}
 */
function getWordleMatrixFromText(text = '') {
  const wordle = [];
  let codePoint, codePointScore;
  let i = 0;
  for(; i < text.length; i++) {
  	codePoint = text.codePointAt(i);
    codePointScore = CODEPOINT_SCORE.get(codePoint);
    if(typeof codePointScore === 'number') {
      wordle.push(codePointScore);
    }
  }
  return wordle;
}

export default getWordleMatrixFromText;