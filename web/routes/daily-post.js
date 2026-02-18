// @ts-nocheck
import * as express from "express";
import db from '../../dist/db/sqlite.js';
import BotController from '../../dist/BotController.js';

const router = express.Router();

const TWENTY_FOUR_HOURS = 24 * 60 * 60 * 1000;

router.post('/', async function (req, res) {
  const secret = process.env['DAILY_POST_SECRET'];
  if (!secret) {
    return res.status(500).json({ status: 'error', message: 'DAILY_POST_SECRET not configured' });
  }

  const auth = req.headers['authorization'];
  if (!auth || auth !== `Bearer ${secret}`) {
    return res.status(401).json({ status: 'error', message: 'Unauthorized' });
  }

  // Check for duplicate post within 24 hours
  const row = db.prepare(
    `SELECT value FROM bot_state WHERE key = ? AND source IS NULL`
  ).get('last_daily_post');

  const lastPostedAt = row?.value || null;

  if (lastPostedAt) {
    const elapsed = Date.now() - new Date(lastPostedAt).getTime();
    if (elapsed < TWENTY_FOUR_HOURS) {
      return res.status(409).json({
        status: 'skipped',
        message: 'Daily post already made within the last 24 hours',
        lastPostedAt
      });
    }
  }

  try {
    await BotController.postOnly();

    const now = new Date().toISOString();

    // Upsert last_daily_post timestamp
    db.prepare(
      `INSERT INTO bot_state (key, source, value) VALUES (?, NULL, ?)
       ON CONFLICT(key, source) DO UPDATE SET value = excluded.value`
    ).run('last_daily_post', now);

    // The daily post covers yesterday's date
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const postedFor = yesterday.toISOString().slice(0, 10);

    return res.status(200).json({
      status: 'success',
      message: 'Daily post completed',
      lastPostedAt: now,
      postedFor
    });
  } catch (e) {
    return res.status(500).json({
      status: 'error',
      message: e?.message || 'Unknown error during daily post'
    });
  }
});

export default router;
