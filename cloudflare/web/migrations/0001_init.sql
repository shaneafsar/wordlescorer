-- Initial schema for wordlescorer D1 database
-- Ported from ts/db/sqlite.ts

CREATE TABLE IF NOT EXISTS analyzed_posts (
  id TEXT PRIMARY KEY,
  scorer_name TEXT NOT NULL,
  wordle_number INTEGER NOT NULL,
  score INTEGER NOT NULL,
  solved_row INTEGER NOT NULL,
  is_hard_mode INTEGER DEFAULT 0,
  source TEXT NOT NULL,
  url TEXT,
  photo_url TEXT,
  auto_score INTEGER DEFAULT 1,
  created_at INTEGER NOT NULL,
  date_key TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS global_scores (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_key TEXT NOT NULL,
  wordle_number INTEGER NOT NULL,
  wordle_score INTEGER NOT NULL,
  solved_row INTEGER NOT NULL,
  screen_name TEXT,
  url TEXT,
  user_id TEXT,
  is_hard_mode INTEGER DEFAULT 0,
  source TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  date_key TEXT NOT NULL,
  UNIQUE(user_key, date_key)
);

CREATE TABLE IF NOT EXISTS top_scores (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_key TEXT NOT NULL,
  screen_name TEXT,
  wordle_number INTEGER NOT NULL,
  score INTEGER NOT NULL,
  solved_row INTEGER NOT NULL,
  source TEXT NOT NULL,
  url TEXT,
  auto_score INTEGER DEFAULT 1,
  is_hard_mode INTEGER DEFAULT 0,
  created_at INTEGER NOT NULL,
  date_key TEXT NOT NULL,
  UNIQUE(user_key, date_key)
);

CREATE TABLE IF NOT EXISTS bot_state (
  key TEXT NOT NULL,
  source TEXT,
  value TEXT NOT NULL,
  PRIMARY KEY (key, source)
);

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  source TEXT NOT NULL,
  screen_name TEXT,
  photo_url TEXT,
  updated_at INTEGER
);

CREATE TABLE IF NOT EXISTS user_growth (
  user_key TEXT PRIMARY KEY,
  source TEXT,
  last_check_time INTEGER
);

CREATE INDEX IF NOT EXISTS idx_analyzed_date ON analyzed_posts(date_key);
CREATE INDEX IF NOT EXISTS idx_analyzed_scorer ON analyzed_posts(scorer_name);
CREATE INDEX IF NOT EXISTS idx_analyzed_wordle ON analyzed_posts(wordle_number);
CREATE INDEX IF NOT EXISTS idx_analyzed_score ON analyzed_posts(score);
CREATE INDEX IF NOT EXISTS idx_global_date ON global_scores(date_key);
CREATE INDEX IF NOT EXISTS idx_global_user ON global_scores(user_key);
CREATE INDEX IF NOT EXISTS idx_top_date ON top_scores(date_key);
