import { describe, it, expect } from 'vitest';
import { isWordleHardMode, isWordleHardModeFromList } from './isWordleHardMode.js';

describe('isWordleHardMode', () => {
  it('returns false for empty string', () => {
    expect(isWordleHardMode('')).toBe(false);
  });

  it('returns false for normal mode', () => {
    expect(isWordleHardMode('Wordle 589 4/6')).toBe(false);
  });

  it('returns true for hard mode (asterisk)', () => {
    expect(isWordleHardMode('Wordle 589 4/6*')).toBe(true);
  });

  it('handles hash prefix', () => {
    expect(isWordleHardMode('Wordle #589 4/6*')).toBe(true);
  });

  it('handles large numbers with comma separator', () => {
    expect(isWordleHardMode('Wordle 1,234 3/6*')).toBe(true);
  });
});

describe('isWordleHardModeFromList', () => {
  it('returns false for empty list', () => {
    expect(isWordleHardModeFromList([])).toBe(false);
  });

  it('returns true if any item has hard mode', () => {
    expect(isWordleHardModeFromList(['no wordle', 'Wordle 589 4/6*'])).toBe(true);
  });

  it('returns false if no items have hard mode', () => {
    expect(isWordleHardModeFromList(['Wordle 589 4/6', 'other text'])).toBe(false);
  });
});
