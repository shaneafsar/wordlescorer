import { describe, it, expect } from 'vitest';
import getMultiplier from './get-multiplier.js';

describe('getMultiplier', () => {
  it('returns 6 for row 1 indices (0-4)', () => {
    for (let i = 0; i <= 4; i++) {
      expect(getMultiplier(i)).toBe(6);
    }
  });

  it('returns 5 for row 2 indices (5-9)', () => {
    for (let i = 5; i <= 9; i++) {
      expect(getMultiplier(i)).toBe(5);
    }
  });

  it('returns 4 for row 3 indices (10-14)', () => {
    for (let i = 10; i <= 14; i++) {
      expect(getMultiplier(i)).toBe(4);
    }
  });

  it('returns 3 for row 4 indices (15-19)', () => {
    for (let i = 15; i <= 19; i++) {
      expect(getMultiplier(i)).toBe(3);
    }
  });

  it('returns 2 for row 5 indices (20-24)', () => {
    for (let i = 20; i <= 24; i++) {
      expect(getMultiplier(i)).toBe(2);
    }
  });

  it('returns 1 for row 6 indices (25-29)', () => {
    for (let i = 25; i <= 29; i++) {
      expect(getMultiplier(i)).toBe(1);
    }
  });
});
