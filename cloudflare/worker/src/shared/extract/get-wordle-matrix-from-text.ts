import { CODEPOINT_SCORE } from '../const/SCORE-CONST';

function getWordleMatrixFromText(text: string = ''): number[] {
  const wordle: number[] = [];
  let codePoint: number | undefined, codePointScore: number | undefined;
  let i = 0;
  for (; i < text.length; i++) {
    codePoint = text.codePointAt(i);
    if (typeof codePoint === 'number') {
      codePointScore = CODEPOINT_SCORE.get(codePoint);
    }
    if (typeof codePointScore === 'number') {
      wordle.push(codePointScore);
    }
  }
  return wordle;
}

export default getWordleMatrixFromText;
