import { describe, it, expect } from 'vitest';
import getFormattedGlobalStats from './get-formatted-global-stats.js';

describe('getFormattedGlobalStats', () => {
  it('returns empty array for empty stats', () => {
    expect(getFormattedGlobalStats([])).toEqual([]);
  });

  it('formats a single stat correctly', () => {
    const stats = [{
      total: 100,
      key: 589,
      solvedRowCounts: [5, 10, 20, 30, 25, 8, 2]
    }];
    const result = getFormattedGlobalStats(stats);
    expect(result).toHaveLength(1);
    expect(result[0]).toContain('#Wordle 589');
    expect(result[0]).toContain('100');
    expect(result[0]).toContain('Row 1:');
    expect(result[0]).toContain('Row 6:');
    expect(result[0]).toContain('Not solved:');
  });

  it('formats multiple stats sorted by total', () => {
    const stats = [
      { total: 50, key: 588, solvedRowCounts: [2, 5, 10, 15, 10, 5, 3] },
      { total: 100, key: 589, solvedRowCounts: [5, 10, 20, 30, 25, 8, 2] },
    ];
    const result = getFormattedGlobalStats(stats);
    expect(result).toHaveLength(2);
    // Most popular (highest total) should be first
    expect(result[0]).toContain('#Wordle 589');
    expect(result[1]).toContain('#Wordle 588');
  });
});
