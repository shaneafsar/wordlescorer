/**
 * getSentenceSuffix
 * @param {Number} solvedRowNum
 * @returns {String}
 */
export function getSentenceSuffix(solvedRowNum) {
  if (solvedRowNum === 0) {
    return '.';
  }
  return `, solved on row ${solvedRowNum}.`;
}
