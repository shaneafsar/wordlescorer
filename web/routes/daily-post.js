// @ts-nocheck
import * as express from "express";
import db from '../../dist/db/sqlite.js';
import BotController from '../../dist/BotController.js';

const router = express.Router();

function getYesterdayDateKey() {
  const yesterday = new Date();
  yesterday.setUTCDate(yesterday.getUTCDate() - 1);
  return yesterday.toISOString().slice(0, 10);
}

router.post('/', async function (req, res) {
  const secret = process.env['DAILY_POST_SECRET'];
  if (!secret) {
    return res.status(500).json({ status: 'error', message: 'DAILY_POST_SECRET not configured' });
  }

  const auth = req.headers['authorization'];
  if (!auth || auth !== `Bearer ${secret}`) {
    return res.status(401).json({ status: 'error', message: 'Unauthorized' });
  }

  const postedFor = getYesterdayDateKey();

  // Check if we already posted for yesterday's date
  const row = db.prepare(
    `SELECT value FROM bot_state WHERE key = ? AND source IS NULL`
  ).get('last_daily_post_date');

  if (row?.value === postedFor) {
    return res.status(409).json({
      status: 'skipped',
      message: `Daily post already made for ${postedFor}`,
      postedFor
    });
  }

  try {
    await BotController.postOnly();

    // Record which date we posted for
    db.prepare(
      `INSERT INTO bot_state (key, source, value) VALUES (?, NULL, ?)
       ON CONFLICT(key, source) DO UPDATE SET value = excluded.value`
    ).run('last_daily_post_date', postedFor);

    return res.status(200).json({
      status: 'success',
      message: 'Daily post completed',
      lastPostedAt: new Date().toISOString(),
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
