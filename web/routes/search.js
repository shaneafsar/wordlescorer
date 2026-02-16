// @ts-nocheck
import * as express from "express";
import db from '../../dist/db/sqlite.js';

const router = express.Router();

router.get('/', function (req, res, next) {
  res.send('respond with a resource');
});

router.get('/api', function (req, res, next) {
  const {
    q = '',
    wordleNumber = '',
    solvedRow = '',
    scoreMin = '',
    scoreMax = '',
    source = '',
    page = '0',
    pageSize = '20'
  } = req.query;

  const pageNum = Math.max(0, parseInt(page, 10) || 0);
  const size = Math.min(100, Math.max(1, parseInt(pageSize, 10) || 20));
  const offset = pageNum * size;

  let where = [];
  let params = [];

  if (q) {
    where.push('scorer_name LIKE ?');
    params.push(`%${q}%`);
  }
  if (wordleNumber) {
    where.push('wordle_number = ?');
    params.push(parseInt(wordleNumber, 10));
  }
  if (solvedRow !== '') {
    where.push('solved_row = ?');
    params.push(parseInt(solvedRow, 10));
  }
  if (scoreMin) {
    where.push('score >= ?');
    params.push(parseInt(scoreMin, 10));
  }
  if (scoreMax) {
    where.push('score <= ?');
    params.push(parseInt(scoreMax, 10));
  }
  if (source) {
    where.push('source = ?');
    params.push(source);
  }

  const whereClause = where.length > 0 ? 'WHERE ' + where.join(' AND ') : '';

  // Get total count
  const countRow = db.prepare(`SELECT COUNT(*) as total FROM analyzed_posts ${whereClause}`).get(...params);
  const total = countRow?.total || 0;

  // Get results
  const rows = db.prepare(
    `SELECT id, scorer_name, wordle_number, score, solved_row, is_hard_mode, source, url, auto_score, created_at, date_key
     FROM analyzed_posts ${whereClause}
     ORDER BY created_at DESC
     LIMIT ? OFFSET ?`
  ).all(...params, size, offset);

  // Get facet counts for filters
  const facets = {};

  if (!wordleNumber) {
    facets.wordleNumbers = db.prepare(
      `SELECT wordle_number as value, COUNT(*) as count FROM analyzed_posts ${whereClause} GROUP BY wordle_number ORDER BY wordle_number DESC LIMIT 20`
    ).all(...params);
  }

  if (solvedRow === '') {
    facets.solvedRows = db.prepare(
      `SELECT solved_row as value, COUNT(*) as count FROM analyzed_posts ${whereClause} GROUP BY solved_row ORDER BY solved_row`
    ).all(...params);
  }

  res.json({
    hits: rows.map(r => ({
      id: r.id,
      scorerName: r.scorer_name,
      wordleNumber: r.wordle_number,
      score: r.score,
      solvedRow: r.solved_row,
      isHardMode: !!r.is_hard_mode,
      source: r.source,
      url: r.url,
      autoScore: !!r.auto_score,
      date_timestamp: Math.floor(r.created_at / 1000),
    })),
    total,
    page: pageNum,
    pageSize: size,
    totalPages: Math.ceil(total / size),
    facets
  });
});

export default router;
