import { describe, it, expect } from 'vitest';
import getWordleMatrixFromText from './get-wordle-matrix-from-text.js';

describe('getWordleMatrixFromText', () => {
  it('returns empty array for empty string', () => {
    expect(getWordleMatrixFromText('')).toEqual([]);
  });

  it('returns empty array for text with no emoji', () => {
    expect(getWordleMatrixFromText('hello world')).toEqual([]);
  });

  it('parses a single row of all correct (green squares)', () => {
    // 🟩 = codepoint 129001 = CORRECT (2)
    const row = '🟩🟩🟩🟩🟩';
    expect(getWordleMatrixFromText(row)).toEqual([2, 2, 2, 2, 2]);
  });

  it('parses a single row of all wrong (black squares)', () => {
    // ⬛ = codepoint 11035 = WRONG (0)
    const row = '⬛⬛⬛⬛⬛';
    expect(getWordleMatrixFromText(row)).toEqual([0, 0, 0, 0, 0]);
  });

  it('parses a single row of all partial (yellow squares)', () => {
    // 🟨 = codepoint 129000 = PARTIAL (1)
    const row = '🟨🟨🟨🟨🟨';
    expect(getWordleMatrixFromText(row)).toEqual([1, 1, 1, 1, 1]);
  });

  it('parses mixed row', () => {
    const row = '⬛🟨🟩⬛🟨';
    expect(getWordleMatrixFromText(row)).toEqual([0, 1, 2, 0, 1]);
  });

  it('parses a full 6-row wordle grid', () => {
    const grid = '⬛⬛⬛⬛⬛\n⬛🟨⬛⬛⬛\n⬛⬛🟩⬛🟨\n🟨🟩🟩⬛⬛\n⬛🟩🟩🟩🟩\n🟩🟩🟩🟩🟩';
    const result = getWordleMatrixFromText(grid);
    expect(result).toHaveLength(30);
    // Last row should be all correct
    expect(result.slice(-5)).toEqual([2, 2, 2, 2, 2]);
  });

  it('handles high contrast green squares (🟧)', () => {
    // 🟧 = codepoint 129000+1? Actually high contrast: 🟧 = 128999 = CORRECT
    // 🟦 = 128998 = PARTIAL
    const row = '🟦🟧🟦🟧🟧';
    expect(getWordleMatrixFromText(row)).toEqual([1, 2, 1, 2, 2]);
  });

  it('handles white squares (⬜) as wrong', () => {
    // ⬜ = codepoint 11036 = WRONG (0)
    const row = '⬜⬜⬜⬜⬜';
    expect(getWordleMatrixFromText(row)).toEqual([0, 0, 0, 0, 0]);
  });

  it('ignores non-wordle text surrounding the grid', () => {
    const text = 'Wordle 589 4/6\n\n⬛⬛🟨⬛⬛\n🟩🟩🟩🟩🟩';
    const result = getWordleMatrixFromText(text);
    expect(result).toEqual([0, 0, 1, 0, 0, 2, 2, 2, 2, 2]);
  });
});
