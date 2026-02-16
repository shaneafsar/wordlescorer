import { describe, it, expect } from 'vitest';
import checkIsSameDay from './is-same-day.js';

describe('checkIsSameDay', () => {
  it('returns true for same date objects', () => {
    const d = new Date('2024-01-15T12:00:00Z');
    expect(checkIsSameDay(d, d)).toBe(true);
  });

  it('returns true for same UTC day different times', () => {
    const d1 = new Date('2024-01-15T00:00:00Z');
    const d2 = new Date('2024-01-15T23:59:59Z');
    expect(checkIsSameDay(d1, d2)).toBe(true);
  });

  it('returns false for different UTC days', () => {
    const d1 = new Date('2024-01-15T00:00:00Z');
    const d2 = new Date('2024-01-16T00:00:00Z');
    expect(checkIsSameDay(d1, d2)).toBe(false);
  });

  it('accepts string for first argument', () => {
    const d2 = new Date('2024-01-15T12:00:00Z');
    expect(checkIsSameDay('2024-01-15T05:00:00Z', d2)).toBe(true);
  });

  it('returns false for same day different months', () => {
    const d1 = new Date('2024-01-15T00:00:00Z');
    const d2 = new Date('2024-02-15T00:00:00Z');
    expect(checkIsSameDay(d1, d2)).toBe(false);
  });
});
