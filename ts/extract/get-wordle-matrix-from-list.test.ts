import { describe, it, expect } from 'vitest';
import getWordleMatrixFromList from './get-wordle-matrix-from-list.js';

describe('getWordleMatrixFromList', () => {
  it('returns empty array for empty list', () => {
    expect(getWordleMatrixFromList([])).toEqual([]);
  });

  it('extracts matrix from emoji text', () => {
    const list = ['Wordle 589 4/6\n⬛🟨⬛⬛⬛\n⬛⬛🟩⬛🟨\n🟨🟩🟩⬛⬛\n🟩🟩🟩🟩🟩'];
    const result = getWordleMatrixFromList(list);
    expect(result).toHaveLength(20);
    expect(result.slice(-5)).toEqual([2, 2, 2, 2, 2]);
  });

  it('falls back to alt text parsing when emoji parsing fails', () => {
    const list = ['Line 1: 2nd and 4th correct but in the wrong place.\nLine 2: Won!'];
    const result = getWordleMatrixFromList(list);
    expect(result).toHaveLength(10);
    expect(result.slice(-5)).toEqual([2, 2, 2, 2, 2]);
  });

  it('tries multiple items in the list', () => {
    const list = [
      'no wordle content here',
      'Wordle 589 4/6\n⬛🟨⬛⬛⬛\n🟩🟩🟩🟩🟩'
    ];
    const result = getWordleMatrixFromList(list);
    expect(result).toHaveLength(10);
  });

  it('prefers emoji parsing over alt text', () => {
    const emojiText = '⬛⬛⬛⬛⬛\n🟩🟩🟩🟩🟩';
    const altText = 'Line 1: Won!';
    const result = getWordleMatrixFromList([emojiText, altText]);
    // Should find the emoji version (2 rows) before trying alt text
    expect(result).toHaveLength(10);
  });
});
