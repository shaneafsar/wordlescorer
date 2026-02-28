function isWordleHardMode(text: string = ''): boolean {
  const match = text.match(/wordle\s*#?\s*\d+(?:[,\.\s]\d{3})?\s*\d+\/\d+\s*(\*)?/i);

  if (match) {
    return !!match[1];
  }

  return false;
}

function isWordleHardModeFromList(list: string[]): boolean {
  for (const item of list) {
    if (isWordleHardMode(item)) {
      return true;
    }
  }
  return false;
}

export { isWordleHardMode, isWordleHardModeFromList };
