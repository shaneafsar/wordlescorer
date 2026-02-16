import { describe, it, expect } from 'vitest';
import getWordleMatrixFromImageAltText from './get-wordle-matrix-from-image-alt-text.js';

describe('getWordleMatrixFromImageAltText', () => {
  it('returns empty array for empty string', () => {
    expect(getWordleMatrixFromImageAltText('')).toEqual([]);
  });

  it('returns empty array for whitespace-only', () => {
    expect(getWordleMatrixFromImageAltText('   ')).toEqual([]);
  });

  it('parses "Won!" as all correct', () => {
    const text = 'Line 1: Won!';
    expect(getWordleMatrixFromImageAltText(text)).toEqual([2, 2, 2, 2, 2]);
  });

  it('parses partial positions (wrong place)', () => {
    // Trailing period causes a split into 2 segments; second is empty → extra zero row
    const text = 'Line 1: 2nd and 4th correct but in the wrong place.';
    const result = getWordleMatrixFromImageAltText(text);
    expect(result.slice(0, 5)).toEqual([0, 1, 0, 1, 0]);
  });

  it('parses perfect positions', () => {
    const text = 'Line 1: 1st and 3rd are perfect.';
    const result = getWordleMatrixFromImageAltText(text);
    expect(result.slice(0, 5)).toEqual([2, 0, 2, 0, 0]);
  });

  it('parses mixed perfect and wrong place', () => {
    const text = 'Line 1: 1st is perfect but 3rd and 5th are in the wrong place.';
    const result = getWordleMatrixFromImageAltText(text);
    expect(result.slice(0, 5)).toEqual([2, 0, 1, 0, 1]);
  });

  it('parses all correct letters in wrong order', () => {
    const text = 'Line 1: all the correct letters but in the wrong order.';
    const result = getWordleMatrixFromImageAltText(text);
    expect(result.slice(0, 5)).toEqual([1, 1, 1, 1, 1]);
  });

  it('parses a multi-line game with newlines', () => {
    const text = 'Line 1: 2nd and 4th correct but in the wrong place.\nLine 2: 1st and 5th correct but in the wrong place.\nLine 3: 5th correct but in the wrong place.\nLine 4: Won!';
    const result = getWordleMatrixFromImageAltText(text);
    expect(result).toHaveLength(20);
    // Last row (Won!) should be all correct
    expect(result.slice(-5)).toEqual([2, 2, 2, 2, 2]);
  });

  it('parses a multi-line game with periods as separators', () => {
    const text = 'Line 1: 2nd and 4th correct but in the wrong place.Line 2: Won!';
    const result = getWordleMatrixFromImageAltText(text);
    expect(result).toHaveLength(10);
    expect(result.slice(-5)).toEqual([2, 2, 2, 2, 2]);
  });

  it('returns empty array when all values are zero (no recognizable patterns)', () => {
    const text = 'Line 1: nothing here\nLine 2: still nothing';
    expect(getWordleMatrixFromImageAltText(text)).toEqual([]);
  });
});
