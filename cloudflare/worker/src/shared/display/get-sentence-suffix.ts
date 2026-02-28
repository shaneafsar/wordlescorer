export function getSentenceSuffix(solvedRowNum: number): string {
  if (solvedRowNum === 0) {
    return '.';
  }
  return `, solved on row ${solvedRowNum}.`;
}
