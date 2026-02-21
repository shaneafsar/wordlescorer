import { describe, it, expect } from 'vitest';
import isValidWordle from './is-valid-wordle.js';

// Calculate today's expected wordle number for tests
const WORDLE_EPOCH = new Date('2021-06-19T00:00:00Z').getTime();
const todayWordle = Math.floor((Date.now() - WORDLE_EPOCH) / 86400000) + 1;

describe('isValidWordle', () => {
  it('returns false for empty array', () => {
    expect(isValidWordle([])).toBe(false);
  });

  it('returns false for array not multiple of 5', () => {
    expect(isValidWordle([0, 1, 2])).toBe(false);
    expect(isValidWordle([0, 1, 2, 0, 1, 2])).toBe(false);
  });

  it('returns true for valid 1-row wordle', () => {
    expect(isValidWordle([2, 2, 2, 2, 2])).toBe(true);
  });

  it('returns true for valid 6-row wordle', () => {
    const wordle = Array(30).fill(0);
    expect(isValidWordle(wordle)).toBe(true);
  });

  it('returns false when wordleNumber is 0', () => {
    expect(isValidWordle([2, 2, 2, 2, 2], 0)).toBe(false);
  });

  it('returns true when wordleNumber is within ±7 of expected', () => {
    expect(isValidWordle([2, 2, 2, 2, 2], todayWordle)).toBe(true);
    expect(isValidWordle([2, 2, 2, 2, 2], todayWordle - 7)).toBe(true);
    expect(isValidWordle([2, 2, 2, 2, 2], todayWordle + 7)).toBe(true);
  });

  it('returns false when wordleNumber is outside ±7 of expected', () => {
    expect(isValidWordle([2, 2, 2, 2, 2], todayWordle - 8)).toBe(false);
    expect(isValidWordle([2, 2, 2, 2, 2], todayWordle + 8)).toBe(false);
    expect(isValidWordle([2, 2, 2, 2, 2], 5)).toBe(false);
  });

  it('returns false when solvedRow is 7 or more', () => {
    expect(isValidWordle([2, 2, 2, 2, 2], todayWordle, 7)).toBe(false);
    expect(isValidWordle([2, 2, 2, 2, 2], todayWordle, 10)).toBe(false);
  });

  it('returns true when solvedRow is less than 7', () => {
    expect(isValidWordle([2, 2, 2, 2, 2], todayWordle, 1)).toBe(true);
    expect(isValidWordle([2, 2, 2, 2, 2], todayWordle, 6)).toBe(true);
  });

  it('returns true when solvedRow is 0 (unsolved)', () => {
    expect(isValidWordle(Array(30).fill(0), todayWordle, 0)).toBe(true);
  });
});
