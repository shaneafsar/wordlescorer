import getWordleMatrixFromImageAltText from "./get-wordle-matrix-from-image-alt-text.js";
import getWordleMatrixFromText from "./get-wordle-matrix-from-text.js";
import isValidWordle from "../calculate/is-valid-wordle.js";

/**
 * Provides the most likely wordle result
 * @param {string[]} list 
 * @returns {Number[]}
 */
export default function getWordleMatrixFromList(list) {
    /**
     * @type {number[]}
     */
    let wordleMatrix = [];
    for(const item of list) {
        wordleMatrix = getWordleMatrixFromText(item);
        console.log('wordleMatrix prealt ', wordleMatrix);
        console.log('isValid wordle ', isValidWordle(wordleMatrix));
        if(isValidWordle(wordleMatrix)){
            return wordleMatrix;
        }
        wordleMatrix = getWordleMatrixFromImageAltText(item);
        if(isValidWordle(wordleMatrix)) {
            return wordleMatrix;
        }
    }
    return wordleMatrix;
}