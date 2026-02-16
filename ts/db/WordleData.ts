import db from './sqlite.js';

function getDateKey(date: Date): string {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-${String(date.getUTCDate()).padStart(2, '0')}`;
}

class WordleData {
  private date: Date | undefined;
  private name: string;
  private recordType: string | undefined;

  constructor(name: string, subdir?: string, date?: Date) {
    this.date = date;
    this.name = subdir || name.split('_')[0];
    if (name.includes('_')) {
      this.recordType = name.split('_')[1];
      if (this.recordType === 'masto') {
        this.recordType = 'mastodon';
      }
    }
  }

  static init(name: string, date?: Date): WordleData {
    if (!date) {
      date = new Date();
    }
    return new WordleData(`${name}-${date.getUTCMonth()}-${date.getUTCDate()}-${date.getUTCFullYear()}`, name, date);
  }

  async read(key?: string | null, date: Date | null = null, forceMongo: boolean = true): Promise<any> {
    const dateKey = date ? getDateKey(date) : this.date ? getDateKey(this.date) : null;

    if (this.name === 'global-scores') {
      if (key && dateKey) {
        return db.prepare('SELECT * FROM global_scores WHERE user_key = ? AND date_key = ?').get(key, dateKey);
      } else if (key) {
        if (key === 'since_id') {
          const row = db.prepare('SELECT value FROM bot_state WHERE key = ? AND source = ?').get('since_id', this.recordType) as any;
          return row?.value;
        }
        if (dateKey) {
          return db.prepare('SELECT * FROM global_scores WHERE user_key = ? AND date_key = ?').get(key, dateKey);
        }
        return db.prepare('SELECT * FROM global_scores WHERE user_key = ?').get(key);
      } else if (dateKey) {
        const rows = db.prepare('SELECT * FROM global_scores WHERE date_key = ?').all(dateKey);
        return rows.map((r: any) => ({
          ...r,
          wordleNumber: r.wordle_number,
          wordleScore: r.wordle_score,
          solvedRow: r.solved_row,
          screenName: r.screen_name,
          userId: r.user_id,
          isHardMode: !!r.is_hard_mode,
          key: r.user_key,
        }));
      }
      return null;
    }

    if (this.name === 'top-scores') {
      if (dateKey) {
        const rows = db.prepare('SELECT * FROM top_scores WHERE date_key = ?').all(dateKey);
        return rows.map((r: any) => ({
          ...r,
          wordleNumber: r.wordle_number,
          score: r.score,
          solvedRow: r.solved_row,
          screenName: r.screen_name,
          isHardMode: !!r.is_hard_mode,
          datetime: r.created_at,
          key: r.user_key,
        }));
      }
      return null;
    }

    if (this.name === 'analyzed') {
      if (key) {
        return db.prepare('SELECT * FROM analyzed_posts WHERE id = ?').get(key);
      }
      return null;
    }

    if (this.name === 'users') {
      if (key) {
        return db.prepare('SELECT * FROM users WHERE id = ?').get(key);
      }
      return null;
    }

    if (this.name === 'user-growth') {
      if (key === 'since_id') {
        const row = db.prepare('SELECT value FROM bot_state WHERE key = ? AND source = ?').get('since_id', this.recordType) as any;
        return row?.value;
      }
      if (key === 'lastCheckTime') {
        const row = db.prepare('SELECT last_check_time FROM user_growth WHERE user_key = ?').get('lastCheckTime') as any;
        return row ? { lastCheckTime: row.last_check_time } : null;
      }
      if (key) {
        const row = db.prepare('SELECT * FROM user_growth WHERE user_key = ?').get(key) as any;
        return row ? { lastCheckTime: row.last_check_time } : null;
      }
      return null;
    }

    if (this.name === 'last-mention') {
      if (key === 'since_id') {
        const row = db.prepare('SELECT value FROM bot_state WHERE key = ? AND source = ?').get('since_id', this.recordType) as any;
        return row?.value;
      }
      return null;
    }

    return null;
  }

  async count(): Promise<number | undefined> {
    if (this.name === 'analyzed') {
      const row = db.prepare('SELECT COUNT(*) as cnt FROM analyzed_posts').get() as any;
      return row?.cnt;
    }
    if (this.name === 'users') {
      const row = db.prepare('SELECT COUNT(*) as cnt FROM users').get() as any;
      return row?.cnt;
    }
    return 0;
  }

  async write(key: string, data: any, date: Date | null = null, forceMongo: boolean = false): Promise<any> {
    const now = Date.now();
    const dateKey = date ? getDateKey(date) : this.date ? getDateKey(this.date) : getDateKey(new Date());

    if (key === 'since_id') {
      db.prepare('INSERT OR REPLACE INTO bot_state (key, source, value) VALUES (?, ?, ?)').run('since_id', this.recordType, data);
      return;
    }

    if (this.name === 'global-scores') {
      db.prepare(`INSERT OR REPLACE INTO global_scores (user_key, wordle_number, wordle_score, solved_row, screen_name, url, user_id, is_hard_mode, source, created_at, date_key)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
        key,
        data.wordleNumber || 0,
        data.wordleScore || 0,
        data.solvedRow || 0,
        data.screenName || '',
        data.url || '',
        data.userId || key,
        data.isHardMode ? 1 : 0,
        data.source || this.recordType || '',
        data.datetime || now,
        dateKey
      );
      return;
    }

    if (this.name === 'top-scores') {
      db.prepare(`INSERT OR REPLACE INTO top_scores (user_key, screen_name, wordle_number, score, solved_row, source, url, auto_score, is_hard_mode, created_at, date_key)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
        key,
        data.screenName || '',
        data.wordleNumber || 0,
        data.score || 0,
        data.solvedRow || 0,
        data.source || this.recordType || '',
        data.url || '',
        data.autoScore ? 1 : 0,
        data.isHardMode ? 1 : 0,
        data.datetime || now,
        dateKey
      );
      return;
    }

    if (this.name === 'analyzed') {
      db.prepare(`INSERT OR REPLACE INTO analyzed_posts (id, scorer_name, wordle_number, score, solved_row, is_hard_mode, source, url, auto_score, created_at, date_key)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
        key,
        data.scorerName || '',
        data.wordleNumber || 0,
        data.score || 0,
        data.solvedRow || 0,
        data.isHardMode ? 1 : 0,
        data.source || this.recordType || '',
        data.url || '',
        data.autoScore ? 1 : 0,
        data.date_timestamp ? data.date_timestamp * 1000 : now,
        dateKey
      );
      return;
    }

    if (this.name === 'users') {
      db.prepare(`INSERT OR REPLACE INTO users (id, source, screen_name, photo_url, updated_at)
        VALUES (?, ?, ?, ?, ?)`).run(
        key,
        this.recordType || '',
        data.screen_name || '',
        data.photo || '',
        now
      );
      return;
    }

    if (this.name === 'user-growth') {
      db.prepare(`INSERT OR REPLACE INTO user_growth (user_key, source, last_check_time)
        VALUES (?, ?, ?)`).run(
        key,
        this.recordType || '',
        data.lastCheckTime || now
      );
      return;
    }

    if (this.name === 'last-mention') {
      if (key === 'since_id') {
        db.prepare('INSERT OR REPLACE INTO bot_state (key, source, value) VALUES (?, ?, ?)').run('since_id', this.recordType, data);
      }
      return;
    }
  }

  async hasKeyAsync(val: string): Promise<boolean> {
    if (this.name === 'analyzed') {
      const row = db.prepare('SELECT 1 FROM analyzed_posts WHERE id = ?').get(val);
      return !!row;
    }
    if (this.name === 'user-growth') {
      if (val === 'lastCheckTime') {
        const row = db.prepare('SELECT 1 FROM user_growth WHERE user_key = ?').get('lastCheckTime');
        return !!row;
      }
      const row = db.prepare('SELECT 1 FROM user_growth WHERE user_key = ?').get(val);
      return !!row;
    }
    return false;
  }

  async loadData(): Promise<void> {
    return Promise.resolve();
  }
}

export default WordleData;
