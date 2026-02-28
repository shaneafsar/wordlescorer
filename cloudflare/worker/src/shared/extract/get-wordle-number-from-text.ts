function getWordleNumberFromText(text: string = ''): number {
  // Step 1: Check for space separator
  let match = text.match(/wordle\s*#?\s*(\d{1,3}\s\d{3})/i);
  if (match) {
    return parseInt(match[1].replace(/\s/g, ''), 10);
  }

  // Step 2: Check for period or comma separator
  match = text.match(/wordle\s*#?\s*(\d{1,3}[,\.]\d{3})/i);
  if (match) {
    return parseInt(match[1].replace(/[,\s.]/g, ''), 10);
  }

  // Step 3: Normal extraction for numbers without any thousand separators
  match = text.match(/wordle\s*#?\s*(\d+)/i);
  if (match) {
    return parseInt(match[1], 10);
  }

  // Return 0 if no matching number is found
  return 0;
}

function getWordleNumberFromList(list: string[]): number {
  for (const item of list) {
    const output = getWordleNumberFromText(item);
    if (output !== 0) {
      return output;
    }
  }
  return 0;
}

export { getWordleNumberFromText, getWordleNumberFromList };
