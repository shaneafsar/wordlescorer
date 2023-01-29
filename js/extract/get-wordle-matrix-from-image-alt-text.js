// @ts-nocheck
import { SCORE } from '../const/SCORE-CONST.js';

/**
 * Converts wa11y.co alt text to a wordle score matrix
 * @param {String} text - alt text from wa11y.co
 * @returns {Number[]} array of scores
 */
 function getWordleMatrixFromImageAltText(text = '') {
  if(text.trim() === '') {
    return [];
  }

  // TODO: duck-type check the text for appropriate general format before continuing
   
  var lines = text.split('\n');

  const output = lines.map((line) => {
    var row = Array(5).fill(0, 0);
    
    // Nothing <-- empty row => line.match(/Nothing/gi)

    // all greens (perfect)
    if (!!line.match(/Won/g)) {
      row.fill(SCORE.CORRECT, 0);
    
    // 1-4 yellows
    } else if(!!line.match(/but in the wrong place/gi)) {
      var matches = line.match(/(?<=:.*)[1-5]/g);
      _rowUpdater(row, matches, SCORE.PARTIAL);

    // greens and yellows (mix of 1-4 greens, 1-4 yellows)
    } else if(line.indexOf('in the wrong place') > -1 && line.indexOf('perfect') > -1) {
      var split = line.split('but');
      var correct = split[0]?.match(/(?<=:.*)[1-5]/g);
      var partials = split[1]?.match(/[1-5]/g);
    
      _rowUpdater(row, correct, SCORE.CORRECT);
      _rowUpdater(row, partials, SCORE.PARTIAL);
    
    // Only greens
    } else if(line.indexOf('perfect') > -1) {
      var matches = line.match(/(?<=:.*)[1-5]/g);
      // If it only has the word "perfect" and no numbers, assume it's all greens.
      if (!matches) {
        row.fill(SCORE.CORRECT, 0);
      } else {
        _rowUpdater(row, matches, SCORE.CORRECT);
      }

    // 100% yellows
    } else if(line.indexOf('all the correct letters but in the wrong order') > -1) {
      row.fill(SCORE.PARTIAL, 0);
    }
    return row;
  }).flat();

  // If every single line is invalid, then reject this wordle
  // e.g. single line with only 0s means nothing was matched & not solved
  if (output.every((val) => val === 0)) {
    return [];
  }
   
  return output;
}


function _rowUpdater(row, matches, score) {
  if(!!matches) {
    for (var j=0; j<matches.length; j++) {
      row[matches[j]-1] = score;
    }
  }
  return row;
}

export default getWordleMatrixFromImageAltText;