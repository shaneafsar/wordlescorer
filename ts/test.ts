import getWordleMatrixFromList from "../js/extract/get-wordle-matrix-from-list.js";
import { JSDOM } from 'jsdom';

const htmlToParse = `<p>Wordle 589 4/6</p><p>Line 1: 2nd and 4th correct but in the wrong place.<br>Line 2: 1st and 5th correct but in the wrong place.<br>Line 3: 5th correct but in the wrong place.<br>Line 4: Won!</p>`;


const dom = new JSDOM(htmlToParse);
const parsedText = dom.window.document.body.textContent || '';

console.log('parsedText ', parsedText);
console.log('get wordle matrx ', getWordleMatrixFromList([`Wordle 589 4/6Line 1: 2nd and 4th correct but in the wrong place.Line 2: Won!`,parsedText]));