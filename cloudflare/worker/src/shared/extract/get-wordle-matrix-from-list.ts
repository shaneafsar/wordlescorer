import getWordleMatrixFromImageAltText from './get-wordle-matrix-from-image-alt-text';
import getWordleMatrixFromText from './get-wordle-matrix-from-text';
import isValidWordle from '../calculate/is-valid-wordle';

export default function getWordleMatrixFromList(list: string[]): number[] {
  let wordleMatrix: number[] = [];
  for (const item of list) {
    wordleMatrix = getWordleMatrixFromText(item);
    if (isValidWordle(wordleMatrix)) {
      return wordleMatrix;
    }
    wordleMatrix = getWordleMatrixFromImageAltText(item);
    if (isValidWordle(wordleMatrix)) {
      return wordleMatrix;
    }
  }
  return wordleMatrix;
}
