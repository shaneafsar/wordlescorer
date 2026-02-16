/**
 * One-time migration script: MongoDB Atlas → SQLite
 *
 * Usage:
 *   MONGODB_USER=xxx MONGODB_PASS=xxx npx tsx scripts/migrate-from-mongo.ts
 *
 * This script is READ-ONLY against MongoDB. It only inserts into SQLite.
 * Run it once, then verify row counts match.
 */

import { MongoClient, ServerApiVersion } from 'mongodb';
import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import dotenv from 'dotenv';

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, '..', 'data');
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

const DB_PATH = path.join(DATA_DIR, 'wordlescorer.db');
const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');

// Create tables (same schema as ts/db/sqlite.ts)
db.exec(`
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
`);

function getDateKeyFromTimestamp(ts: number): string {
  const d = new Date(ts);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
}

const uri = `mongodb+srv://${process.env['MONGODB_USER']}:${process.env['MONGODB_PASS']}@cluster0.yztewyz.mongodb.net/?retryWrites=true&w=majority`;

function skipIfPopulated(table: string): boolean {
  const row = db.prepare(`SELECT COUNT(*) as cnt FROM ${table}`).get() as any;
  if (row.cnt > 0) {
    console.log(`Skipping ${table}: already has ${row.cnt} rows`);
    return true;
  }
  return false;
}

async function migrate() {
  const client = new MongoClient(uri, {
    serverApi: { version: ServerApiVersion.v1, strict: true, deprecationErrors: true },
    socketTimeoutMS: 300000,
    connectTimeoutMS: 30000,
  });

  await client.connect();
  console.log('Connected to MongoDB');

  const mdb = client.db('wordlescorer');
  const collections = await mdb.listCollections().toArray();
  console.log('Collections:', collections.map(c => c.name).join(', '));

  // Migrate global-scores
  if (!skipIfPopulated('global_scores')) {
    const coll = mdb.collection('global-scores');
    const docs = await coll.find({}).toArray();
    console.log(`global-scores: ${docs.length} documents`);

    const insert = db.prepare(`INSERT OR IGNORE INTO global_scores (user_key, wordle_number, wordle_score, solved_row, screen_name, url, user_id, is_hard_mode, source, created_at, date_key)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);

    const tx = db.transaction(() => {
      for (const doc of docs) {
        const ts = doc.datetime || Date.now();
        const dateKey = getDateKeyFromTimestamp(ts);
        insert.run(
          doc.key || '',
          doc.wordleNumber || 0,
          doc.wordleScore || 0,
          doc.solvedRow || 0,
          doc.screenName || '',
          doc.url || '',
          doc.userId || doc.key || '',
          doc.isHardMode ? 1 : 0,
          doc.source || '',
          ts,
          dateKey
        );
      }
    });
    tx();
    console.log(`  → Inserted into global_scores`);
  }

  // Migrate top-scores
  if (!skipIfPopulated('top_scores')) {
    const coll = mdb.collection('top-scores');
    const docs = await coll.find({}).toArray();
    console.log(`top-scores: ${docs.length} documents`);

    const insert = db.prepare(`INSERT OR IGNORE INTO top_scores (user_key, screen_name, wordle_number, score, solved_row, source, url, auto_score, is_hard_mode, created_at, date_key)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);

    const tx = db.transaction(() => {
      for (const doc of docs) {
        const ts = doc.datetime || Date.now();
        const dateKey = getDateKeyFromTimestamp(ts);
        insert.run(
          doc.key || '',
          doc.screenName || '',
          doc.wordleNumber || 0,
          doc.score || 0,
          doc.solvedRow || 0,
          doc.source || '',
          doc.url || '',
          doc.autoScore ? 1 : 0,
          doc.isHardMode ? 1 : 0,
          ts,
          dateKey
        );
      }
    });
    tx();
    console.log(`  → Inserted into top_scores`);
  }

  // Migrate analyzed posts in batches (large collection)
  if (!skipIfPopulated('analyzed_posts')) {
    const coll = mdb.collection('analyzed');
    const totalCount = await coll.countDocuments();
    console.log(`analyzed: ${totalCount} documents (reading in batches...)`);

    const insert = db.prepare(`INSERT OR IGNORE INTO analyzed_posts (id, scorer_name, wordle_number, score, solved_row, is_hard_mode, source, url, auto_score, created_at, date_key)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);

    let processed = 0;
    const BATCH_SIZE = 10000;
    const cursor = coll.find({}).batchSize(BATCH_SIZE);

    let batch: any[] = [];
    for await (const doc of cursor) {
      batch.push(doc);
      if (batch.length >= BATCH_SIZE) {
        const batchToInsert = batch;
        batch = [];
        const tx = db.transaction(() => {
          for (const d of batchToInsert) {
            const ts = d.date_timestamp ? d.date_timestamp * 1000 : d.datetime || Date.now();
            const dateKey = getDateKeyFromTimestamp(ts);
            insert.run(
              d.key || d._id?.toString() || '',
              d.scorerName || d.name || '',
              d.wordleNumber || 0,
              d.score || 0,
              d.solvedRow || 0,
              d.isHardMode ? 1 : 0,
              d.source || '',
              d.url || '',
              d.autoScore ? 1 : 0,
              ts,
              dateKey
            );
          }
        });
        tx();
        processed += batchToInsert.length;
        console.log(`  → ${processed}/${totalCount} analyzed_posts`);
      }
    }
    // Final batch
    if (batch.length > 0) {
      const tx = db.transaction(() => {
        for (const d of batch) {
          const ts = d.date_timestamp ? d.date_timestamp * 1000 : d.datetime || Date.now();
          const dateKey = getDateKeyFromTimestamp(ts);
          insert.run(
            d.key || d._id?.toString() || '',
            d.scorerName || d.name || '',
            d.wordleNumber || 0,
            d.score || 0,
            d.solvedRow || 0,
            d.isHardMode ? 1 : 0,
            d.source || '',
            d.url || '',
            d.autoScore ? 1 : 0,
            ts,
            dateKey
          );
        }
      });
      tx();
      processed += batch.length;
      console.log(`  → ${processed}/${totalCount} analyzed_posts (done)`);
    }
  }

  // Migrate users
  for (const collName of ['users']) {
    const coll = mdb.collection(collName);
    const docs = await coll.find({}).toArray();
    console.log(`${collName}: ${docs.length} documents`);

    const insert = db.prepare(`INSERT OR IGNORE INTO users (id, source, screen_name, photo_url, updated_at)
      VALUES (?, ?, ?, ?, ?)`);

    const tx = db.transaction(() => {
      for (const doc of docs) {
        insert.run(
          doc.key || doc.user_id || doc._id?.toString() || '',
          doc.source || '',
          doc.screen_name || '',
          doc.photo || '',
          doc.datetime || Date.now()
        );
      }
    });
    tx();
    console.log(`  → Inserted into users`);
  }

  // Migrate bot state (since_id, last-mention)
  for (const collName of ['last-mention']) {
    const coll = mdb.collection(collName);
    const docs = await coll.find({}).toArray();
    console.log(`${collName}: ${docs.length} documents`);

    const insert = db.prepare(`INSERT OR IGNORE INTO bot_state (key, source, value) VALUES (?, ?, ?)`);

    const tx = db.transaction(() => {
      for (const doc of docs) {
        if (doc.key === 'since_id') {
          insert.run('since_id', doc.source || '', doc.since_id || '');
        }
      }
    });
    tx();
    console.log(`  → Inserted into bot_state`);
  }

  // Migrate user-growth
  for (const collName of ['user-growth']) {
    const coll = mdb.collection(collName);
    const docs = await coll.find({}).toArray();
    console.log(`${collName}: ${docs.length} documents`);

    const insert = db.prepare(`INSERT OR IGNORE INTO user_growth (user_key, source, last_check_time) VALUES (?, ?, ?)`);

    const tx = db.transaction(() => {
      for (const doc of docs) {
        insert.run(
          doc.key || '',
          '',
          doc.lastCheckTime || doc.datetime || Date.now()
        );
      }
    });
    tx();
    console.log(`  → Inserted into user_growth`);
  }

  // Verify counts
  console.log('\n=== Verification ===');
  const tables = ['analyzed_posts', 'global_scores', 'top_scores', 'users', 'bot_state', 'user_growth'];
  for (const table of tables) {
    const row = db.prepare(`SELECT COUNT(*) as cnt FROM ${table}`).get() as any;
    console.log(`${table}: ${row.cnt} rows`);
  }

  await client.close();
  db.close();
  console.log('\nMigration complete!');
}

migrate().catch(err => {
  console.error('Migration failed:', err);
  process.exit(1);
});
