import { describe, it, expect } from 'vitest';
import { getSolvedRow } from './get-solved-row.js';

describe('getSolvedRow', () => {
  it('returns 0 for empty array', () => {
    expect(getSolvedRow([])).toBe(0);
  });

  it('returns 1 for solved on row 1', () => {
    expect(getSolvedRow([2, 2, 2, 2, 2])).toBe(1);
  });

  it('returns 2 for solved on row 2', () => {
    expect(getSolvedRow([0, 0, 0, 0, 0, 2, 2, 2, 2, 2])).toBe(2);
  });

  it('returns 6 for solved on row 6', () => {
    const wordle = [
      0, 0, 0, 0, 0,
      0, 1, 0, 0, 0,
      0, 0, 1, 0, 1,
      1, 1, 2, 0, 0,
      0, 2, 2, 2, 2,
      2, 2, 2, 2, 2,
    ];
    expect(getSolvedRow(wordle)).toBe(6);
  });

  it('returns 0 for unsolved (last row not all correct)', () => {
    const wordle = [
      0, 0, 0, 0, 0,
      0, 1, 0, 0, 0,
      0, 0, 1, 0, 1,
      1, 1, 2, 0, 0,
      0, 2, 2, 2, 2,
      1, 2, 2, 2, 2,
    ];
    expect(getSolvedRow(wordle)).toBe(0);
  });

  it('returns 0 for invalid wordle (not multiple of 5)', () => {
    expect(getSolvedRow([2, 2, 2])).toBe(0);
  });
});
