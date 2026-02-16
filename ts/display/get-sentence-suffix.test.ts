import { describe, it, expect } from 'vitest';
import { getSentenceSuffix } from './get-sentence-suffix.js';

describe('getSentenceSuffix', () => {
  it('returns just period for unsolved (row 0)', () => {
    expect(getSentenceSuffix(0)).toBe('.');
  });

  it('returns solved message for row 1', () => {
    expect(getSentenceSuffix(1)).toBe(', solved on row 1.');
  });

  it('returns solved message for row 6', () => {
    expect(getSentenceSuffix(6)).toBe(', solved on row 6.');
  });
});
