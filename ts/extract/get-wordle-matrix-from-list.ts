import getWordleMatrixFromImageAltText from "./get-wordle-matrix-from-image-alt-text.js";
import getWordleMatrixFromText from "./get-wordle-matrix-from-text.js";
import isValidWordle from "../calculate/is-valid-wordle.js";

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