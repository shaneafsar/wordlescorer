import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockRun, mockPrepare } = vi.hoisted(() => {
  const mockRun = vi.fn();
  const mockPrepare = vi.fn(() => ({ run: mockRun }));
  return { mockRun, mockPrepare };
});

vi.mock('./sqlite.js', () => ({
  default: { prepare: mockPrepare, exec: vi.fn(), pragma: vi.fn() },
}));

vi.mock('./pending-writes.js', () => ({
  recordWrite: vi.fn(),
}));

import WordleData from './WordleData.js';

function getDateKey(date: Date): string {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-${String(date.getUTCDate()).padStart(2, '0')}`;
}

describe('WordleData.write() dateKey', () => {
  beforeEach(() => {
    mockRun.mockClear();
    mockPrepare.mockClear();
  });

  it('uses current date for dateKey, not the stale construction date', async () => {
    // Construct with a date in the past (simulating a long-running process)
    const yesterday = new Date();
    yesterday.setUTCDate(yesterday.getUTCDate() - 1);

    const db = WordleData.init('global-scores', yesterday);
    const today = new Date();
    const expectedDateKey = getDateKey(today);
    const yesterdayDateKey = getDateKey(yesterday);

    await db.write('test-user', {
      wordleNumber: 1710,
      wordleScore: 300,
      solvedRow: 3,
      screenName: '@test',
      url: 'https://example.com',
      userId: 'test-user',
      source: 'bluesky',
    });

    expect(mockRun).toHaveBeenCalledTimes(1);
    const params = mockRun.mock.calls[0];
    // dateKey is the last parameter in the global_scores INSERT
    const dateKey = params[params.length - 1];

    expect(dateKey).toBe(expectedDateKey);
    expect(dateKey).not.toBe(yesterdayDateKey);
  });

  it('uses current date for top_scores writes too', async () => {
    const yesterday = new Date();
    yesterday.setUTCDate(yesterday.getUTCDate() - 1);

    const db = WordleData.init('top-scores', yesterday);
    const expectedDateKey = getDateKey(new Date());

    await db.write('test-user', {
      screenName: '@test',
      wordleNumber: 1710,
      score: 300,
      solvedRow: 3,
      source: 'mastodon',
      url: 'https://example.com',
      autoScore: false,
      isHardMode: false,
    });

    expect(mockRun).toHaveBeenCalledTimes(1);
    const params = mockRun.mock.calls[0];
    const dateKey = params[params.length - 1];

    expect(dateKey).toBe(expectedDateKey);
  });

  it('uses explicit date when provided', async () => {
    const pastDate = new Date('2025-01-15T12:00:00Z');
    const db = WordleData.init('global-scores');

    await db.write('test-user', {
      wordleNumber: 1600,
      wordleScore: 200,
      solvedRow: 4,
      screenName: '@test',
      url: '',
      userId: 'test-user',
      source: 'bluesky',
    }, pastDate);

    expect(mockRun).toHaveBeenCalledTimes(1);
    const params = mockRun.mock.calls[0];
    const dateKey = params[params.length - 1];

    expect(dateKey).toBe('2025-01-15');
  });
});
