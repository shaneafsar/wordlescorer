import { describe, it, expect } from 'vitest';
import getPercent from './get-percent.js';

describe('getPercent', () => {
  it('returns 0% for zero', () => {
    expect(getPercent(0, 100)).toBe('0%');
  });

  it('returns <1% for very small percentages', () => {
    expect(getPercent(1, 1000)).toBe('<1%');
  });

  it('returns rounded percentage', () => {
    expect(getPercent(50, 100)).toBe('50%');
    expect(getPercent(1, 3)).toBe('33%');
  });

  it('returns 100% for full', () => {
    expect(getPercent(100, 100)).toBe('100%');
  });
});
