// @ts-nocheck
import * as express from "express";
import db from '../../dist/db/sqlite.js';

const router = express.Router();

// In-memory cache: old days never change, only today's data shifts
let cache = null;
let cacheExpiry = 0;
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

function getRecentDays() {
  const now = Date.now();
  if (cache && now < cacheExpiry) return cache;

  const days = buildRecentDays();
  cache = days;
  cacheExpiry = now + CACHE_TTL;
  return days;
}

function buildRecentDays() {
  const days = db.prepare(
    `SELECT DISTINCT date_key FROM global_scores ORDER BY date_key DESC LIMIT 7`
  ).all();

  const result = days.map(({ date_key }) => {
    // Row distribution: rows 0-6
    const rows = db.prepare(
      `SELECT solved_row, COUNT(*) as cnt FROM global_scores WHERE date_key = ? GROUP BY solved_row`
    ).all(date_key);

    const solvedRowCounts = [0, 0, 0, 0, 0, 0, 0];
    let totalPlayers = 0;
    for (const r of rows) {
      if (r.solved_row >= 0 && r.solved_row <= 6) {
        solvedRowCounts[r.solved_row] = r.cnt;
      }
      totalPlayers += r.cnt;
    }

    const solvedRowPercents = solvedRowCounts.map(c => {
      if (totalPlayers === 0) return '0%';
      const pct = (c / totalPlayers) * 100;
      if (pct > 0 && pct < 1) return '<1%';
      return Math.round(pct) + '%';
    });

    // Most common wordle_number for this date
    const wnRow = db.prepare(
      `SELECT wordle_number, COUNT(*) as cnt FROM global_scores WHERE date_key = ? GROUP BY wordle_number ORDER BY cnt DESC LIMIT 1`
    ).get(date_key);
    const wordleNumber = wnRow ? wnRow.wordle_number : null;

    // Winners: all top_scores entries sharing the max score for this date
    const winners = db.prepare(
      `SELECT screen_name, score, solved_row, source, url FROM top_scores
       WHERE date_key = ? AND score = (SELECT MAX(score) FROM top_scores WHERE date_key = ?)
       ORDER BY created_at ASC`
    ).all(date_key, date_key).map(w => ({
      screenName: w.screen_name,
      score: w.score,
      solvedRow: w.solved_row,
      source: w.source,
      url: w.url
    }));

    return {
      dateKey: date_key,
      wordleNumber,
      totalPlayers,
      solvedRowCounts,
      solvedRowPercents,
      winners
    };
  });

  return result;
}

router.get('/recent-days', function (_req, res) {
  const days = getRecentDays();
  // Browser can cache for 5 min; CDN/proxy for longer since data is mostly static
  res.set('Cache-Control', 'public, max-age=300, stale-while-revalidate=600');
  res.json({ days });
});

export default router;
