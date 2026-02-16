import { SCORE } from '../const/SCORE-CONST.js';

function _rowUpdater(row: number[], matches: string[] | null, score: number): number[] {
  if (!!matches) {
    for (let j = 0; j < matches.length; j++) {
      row[parseInt(matches[j]) - 1] = score;
    }
  }
  return row;
}

function getWordleMatrixFromImageAltText(text: string = ''): number[] {
  if (text.trim() === '') {
    return [];
  }

  // TODO: check the text for appropriate general format before continuing

  let lines = text.split('\n');

  // If we only get back one line, try splitting by period.
  if (lines.length === 1) {
    lines = text.split('.');
  }

  const output = lines.map((line) => {
    const row = Array(5).fill(0, 0);

    // Nothing <-- empty row => line.match(/Nothing/gi)

    // all greens (perfect)
    if (!!line.match(/Won/g)) {
      row.fill(SCORE.CORRECT, 0);

    // 1-4 yellows
    } else if (!!line.match(/but in the wrong place/gi)) {
      const matches = line.match(/(?<=:.*)[1-5]/g);
      _rowUpdater(row, matches, SCORE.PARTIAL);

    // greens and yellows (mix of 1-4 greens, 1-4 yellows)
    } else if (line.indexOf('in the wrong place') > -1 && line.indexOf('perfect') > -1) {
      const split = line.split('but');
      const correct = split[0]?.match(/(?<=:.*)[1-5]/g);
      const partials = split[1]?.match(/[1-5]/g);

      _rowUpdater(row, correct, SCORE.CORRECT);
      _rowUpdater(row, partials, SCORE.PARTIAL);

    // Only greens
    } else if (line.indexOf('perfect') > -1) {
      const matches = line.match(/(?<=:.*)[1-5]/g);
      // If it only has the word "perfect" and no numbers, assume it's all greens.
      if (!matches) {
        row.fill(SCORE.CORRECT, 0);
      } else {
        _rowUpdater(row, matches, SCORE.CORRECT);
      }

    // 100% yellows
    } else if (line.indexOf('all the correct letters but in the wrong order') > -1) {
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

export default getWordleMatrixFromImageAltText;