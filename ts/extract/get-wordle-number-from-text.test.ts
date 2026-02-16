import { describe, it, expect } from 'vitest';
import { getWordleNumberFromText, getWordleNumberFromList } from './get-wordle-number-from-text.js';

describe('getWordleNumberFromText', () => {
  it('returns 0 for empty string', () => {
    expect(getWordleNumberFromText('')).toBe(0);
  });

  it('returns 0 for text without wordle number', () => {
    expect(getWordleNumberFromText('hello world')).toBe(0);
  });

  it('extracts simple wordle number', () => {
    expect(getWordleNumberFromText('Wordle 228 6/6')).toBe(228);
  });

  it('extracts wordle number with hash', () => {
    expect(getWordleNumberFromText('Wordle #589 4/6')).toBe(589);
  });

  it('extracts large wordle number', () => {
    expect(getWordleNumberFromText('Wordle 1234 3/6')).toBe(1234);
  });

  it('handles space as thousand separator', () => {
    expect(getWordleNumberFromText('Wordle 1 234 3/6')).toBe(1234);
  });

  it('handles comma as thousand separator', () => {
    expect(getWordleNumberFromText('Wordle 1,234 3/6')).toBe(1234);
  });

  it('handles period as thousand separator', () => {
    expect(getWordleNumberFromText('Wordle 1.234 3/6')).toBe(1234);
  });

  it('is case insensitive', () => {
    expect(getWordleNumberFromText('WORDLE 500 3/6')).toBe(500);
    expect(getWordleNumberFromText('wordle 500 3/6')).toBe(500);
  });
});

describe('getWordleNumberFromList', () => {
  it('returns 0 for empty list', () => {
    expect(getWordleNumberFromList([])).toBe(0);
  });

  it('finds number from first matching item', () => {
    expect(getWordleNumberFromList(['no wordle here', 'Wordle 400 3/6'])).toBe(400);
  });

  it('returns first non-zero result', () => {
    expect(getWordleNumberFromList(['Wordle 100 2/6', 'Wordle 200 3/6'])).toBe(100);
  });
});
