import { getDateKey } from './util';
import getPercent from './shared/display/get-percent';

const formatter = new Intl.NumberFormat().format;

// ── Analyzed Posts ──

export async function hasAnalyzedPost(db: D1Database, postId: string): Promise<boolean> {
  const row = await db.prepare('SELECT 1 FROM analyzed_posts WHERE id = ?').bind(postId).first();
  return !!row;
}

export async function writeAnalyzedPost(
  db: D1Database, postId: string, data: {
    scorerName: string; wordleNumber: number; score: number; solvedRow: number;
    isHardMode: boolean; source: string; url: string; autoScore: boolean;
  }
): Promise<void> {
  const now = Date.now();
  const dateKey = getDateKey(new Date());
  await db.prepare(
    `INSERT OR REPLACE INTO analyzed_posts (id, scorer_name, wordle_number, score, solved_row, is_hard_mode, source, url, auto_score, created_at, date_key)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(
    postId, data.scorerName, data.wordleNumber, data.score, data.solvedRow,
    data.isHardMode ? 1 : 0, data.source, data.url, data.autoScore ? 1 : 0, now, dateKey
  ).run();
}

// ── Global Scores ──

export async function writeGlobalScore(
  db: D1Database, userKey: string, data: {
    wordleNumber: number; wordleScore: number; solvedRow: number;
    screenName: string; url: string; userId: string;
    isHardMode: boolean; source: string;
  }
): Promise<void> {
  const now = Date.now();
  const dateKey = getDateKey(new Date());
  await db.prepare(
    `INSERT OR REPLACE INTO global_scores (user_key, wordle_number, wordle_score, solved_row, screen_name, url, user_id, is_hard_mode, source, created_at, date_key)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(
    userKey, data.wordleNumber, data.wordleScore, data.solvedRow,
    data.screenName, data.url, data.userId || userKey,
    data.isHardMode ? 1 : 0, data.source, now, dateKey
  ).run();
}

// ── Top Scores ──

export async function writeTopScore(
  db: D1Database, userKey: string, data: {
    screenName: string; wordleNumber: number; score: number; solvedRow: number;
    source: string; url: string; autoScore: boolean; isHardMode: boolean;
    datetime?: number;
  }
): Promise<void> {
  const now = Date.now();
  const dateKey = getDateKey(new Date());
  await db.prepare(
    `INSERT OR REPLACE INTO top_scores (user_key, screen_name, wordle_number, score, solved_row, source, url, auto_score, is_hard_mode, created_at, date_key)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(
    userKey, data.screenName, data.wordleNumber, data.score, data.solvedRow,
    data.source, data.url, data.autoScore ? 1 : 0,
    data.isHardMode ? 1 : 0, data.datetime || now, dateKey
  ).run();
}

// ── Users ──

export async function writeUser(
  db: D1Database, userId: string, data: {
    screenName: string; photo: string; source: string;
  }
): Promise<void> {
  await db.prepare(
    `INSERT OR REPLACE INTO users (id, source, screen_name, photo_url, updated_at)
     VALUES (?, ?, ?, ?, ?)`
  ).bind(userId, data.source, data.screenName, data.photo, Date.now()).run();
}

// ── User Growth ──

export async function writeUserGrowth(
  db: D1Database, userKey: string, data: {
    source: string; lastCheckTime?: number;
  }
): Promise<void> {
  await db.prepare(
    `INSERT OR REPLACE INTO user_growth (user_key, source, last_check_time)
     VALUES (?, ?, ?)`
  ).bind(userKey, data.source, data.lastCheckTime || Date.now()).run();
}

export async function hasUserGrowth(db: D1Database, userKey: string): Promise<boolean> {
  const row = await db.prepare('SELECT 1 FROM user_growth WHERE user_key = ?').bind(userKey).first();
  return !!row;
}

export async function getUserGrowthLastCheck(db: D1Database, userKey: string): Promise<number | null> {
  const row = await db.prepare('SELECT last_check_time FROM user_growth WHERE user_key = ?')
    .bind(userKey).first<{ last_check_time: number }>();
  return row?.last_check_time ?? null;
}

// ── Bot State ──

export async function getBotState(db: D1Database, key: string, source?: string): Promise<string | null> {
  const row = source
    ? await db.prepare('SELECT value FROM bot_state WHERE key = ? AND source = ?').bind(key, source).first<{ value: string }>()
    : await db.prepare('SELECT value FROM bot_state WHERE key = ?').bind(key).first<{ value: string }>();
  return row?.value ?? null;
}

export async function setBotState(db: D1Database, key: string, value: string, source?: string): Promise<void> {
  await db.prepare(
    'INSERT OR REPLACE INTO bot_state (key, source, value) VALUES (?, ?, ?)'
  ).bind(key, source ?? '', value).run();
}

// ── Global Stats (for scorer comparison + daily posts) ──

interface WordleScoreStats {
  total: number;
  key: number;
  solvedRowCounts: number[];
}

export async function getGlobalStats(db: D1Database, date: Date): Promise<WordleScoreStats[]> {
  const dateKey = getDateKey(date);

  // Use SQL GROUP BY to aggregate — returns at most ~14 rows instead of thousands
  const rows = await db.prepare(
    `SELECT wordle_number, solved_row, COUNT(*) as cnt
     FROM global_scores
     WHERE date_key = ? AND solved_row < 7
     GROUP BY wordle_number, solved_row`
  ).bind(dateKey).all();

  const wordleScores: Record<string, WordleScoreStats> = {};

  for (const r of rows.results as any[]) {
    const keyStr = String(r.wordle_number);
    if (!wordleScores[keyStr]) {
      wordleScores[keyStr] = {
        total: 0,
        key: r.wordle_number,
        solvedRowCounts: [0, 0, 0, 0, 0, 0, 0]
      };
    }
    wordleScores[keyStr].solvedRowCounts[r.solved_row] = r.cnt;
    wordleScores[keyStr].total += r.cnt;
  }

  const sortedWordleStats = Object.values(wordleScores).sort((a, b) => b.total - a.total);
  return sortedWordleStats.slice(0, 2).sort((a, b) => b.key - a.key);
}

// ── Scorer Global Stats (for reply text: "Solved above X others") ──

interface ScorerGlobalStatsResult {
  wordlePrefix: string;
  aboveTotal: string;
}

export async function getScorerGlobalStats(
  db: D1Database,
  { solvedRow, wordleNumber, date }: { solvedRow: number; wordleNumber: number; date: Date }
): Promise<ScorerGlobalStatsResult> {
  const globalStats = await getGlobalStats(db, date);

  if (!globalStats || globalStats.length === 0) {
    return { wordlePrefix: 'wordle', aboveTotal: '' };
  }

  const final = globalStats.filter(item => String(item.key) === String(wordleNumber));

  if (final.length > 0) {
    const solvedRowCounts = final[0].solvedRowCounts.slice(0);
    solvedRowCounts.push(final[0].solvedRowCounts[0]);

    let aboveTotal = 0;
    if (solvedRow > 0 && solvedRow < 7) {
      for (let i = solvedRow + 1; i < solvedRowCounts.length; i++) {
        aboveTotal += solvedRowCounts[i];
      }
    }

    const renderAboveTotal = aboveTotal > 1;

    return {
      wordlePrefix: `Wordle #${wordleNumber}`,
      aboveTotal: renderAboveTotal ? `Solved above ${formatter(aboveTotal)} others so far today!` : ''
    };
  }

  return { wordlePrefix: 'wordle', aboveTotal: '' };
}

// ── Top Scorer Info (for daily post) ──

interface ScorerInfo {
  name: string;
  screenName?: string;
  scorerName?: string;
  score: number;
  solvedRow: number;
  datetime: number;
  wordleNumber: number;
  aboveTotal?: number | string;
  percentage?: string;
}

export async function getTopScorerInfo(db: D1Database, date: Date): Promise<ScorerInfo | null> {
  const globalStats = await getGlobalStats(db, date);
  const dateKey = getDateKey(date);

  const topRows = await db.prepare(
    'SELECT * FROM top_scores WHERE date_key = ?'
  ).bind(dateKey).all();

  if (!topRows.results.length || !globalStats.length) {
    return null;
  }

  let scorerList: ScorerInfo[] = (topRows.results as any[]).map(r => ({
    name: r.screen_name || r.user_key,
    screenName: r.screen_name,
    scorerName: r.screen_name,
    score: r.score,
    solvedRow: r.solved_row,
    datetime: r.created_at,
    wordleNumber: r.wordle_number,
  }));

  if (globalStats.length > 1) {
    const globalStat = globalStats[0].total < globalStats[1].total ? globalStats[1] : globalStats[0];

    scorerList = scorerList.filter(scorer => String(globalStat.key) === String(scorer.wordleNumber));

    const solvedRowCounts = globalStat.solvedRowCounts.slice(0);
    solvedRowCounts.push(globalStat.solvedRowCounts[0]);
    const globalStatsTotal = globalStat.total;

    scorerList.forEach(scorer => {
      let above = 0;
      if (scorer.solvedRow !== 0) {
        for (let i = scorer.solvedRow + 1; i < solvedRowCounts.length; i++) {
          above += solvedRowCounts[i];
        }
      }
      scorer.percentage = getPercent(above, globalStatsTotal);
      scorer.aboveTotal = formatter(above);
    });
  } else if (globalStats.length === 1) {
    const globalStat = globalStats[0];
    scorerList = scorerList.filter(scorer => String(globalStat.key) === String(scorer.wordleNumber));

    const solvedRowCounts = globalStat.solvedRowCounts.slice(0);
    solvedRowCounts.push(globalStat.solvedRowCounts[0]);
    const globalStatsTotal = globalStat.total;

    scorerList.forEach(scorer => {
      let above = 0;
      if (scorer.solvedRow !== 0) {
        for (let i = scorer.solvedRow + 1; i < solvedRowCounts.length; i++) {
          above += solvedRowCounts[i];
        }
      }
      scorer.percentage = getPercent(above, globalStatsTotal);
      scorer.aboveTotal = formatter(above);
    });
  }

  // Compare by score, then solved row, then date
  scorerList.sort((a, b) => {
    if (a.score === b.score) {
      if (a.solvedRow === b.solvedRow) {
        return a.datetime - b.datetime;
      }
      return a.solvedRow - b.solvedRow;
    }
    return b.score - a.score;
  });

  return scorerList[0] || null;
}
