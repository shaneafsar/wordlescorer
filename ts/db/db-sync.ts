import { Client } from '@replit/object-storage';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, '..', '..', 'data');
const DB_PATH = process.env['SQLITE_DB_PATH'] || path.join(DATA_DIR, 'wordlescorer.db');
const WAL_PATH = DB_PATH + '-wal';
const REMOTE_DB_KEY = 'wordlescorer.db';
const REMOTE_WAL_KEY = 'wordlescorer.db-wal';

const WAL_SYNC_INTERVAL = 5 * 60 * 1000;      // 5 minutes — WAL is small
const FULL_SYNC_INTERVAL = 12 * 60 * 60 * 1000; // 12 hours — checkpoint + full DB

let walTimer: NodeJS.Timeout | null = null;
let fullTimer: NodeJS.Timeout | null = null;
let lastWalSize: number = 0;
const isReplit = !!process.env['REPL_ID'];

/**
 * Download the DB (and WAL if present) from Replit App Storage.
 * Must be called BEFORE sqlite.ts is imported (which opens the DB on import).
 */
export async function downloadDB(): Promise<void> {
  if (!isReplit) return;

  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }

  try {
    const client = new Client();
    const { ok } = await client.downloadToFilename(REMOTE_DB_KEY, DB_PATH);

    if (ok) {
      // Remove stale SHM — SQLite recreates it on open
      try { fs.unlinkSync(DB_PATH + '-shm'); } catch {}

      const size = fs.statSync(DB_PATH).size;
      console.log(`[db-sync] Downloaded DB from App Storage (${size} bytes)`);

      // Also download WAL if one exists in App Storage
      try {
        const walResult = await client.downloadToFilename(REMOTE_WAL_KEY, WAL_PATH);
        if (walResult.ok) {
          const walSize = fs.statSync(WAL_PATH).size;
          console.log(`[db-sync] Downloaded WAL from App Storage (${walSize} bytes)`);
        } else {
          // No remote WAL — remove any stale local one
          try { fs.unlinkSync(WAL_PATH); } catch {}
        }
      } catch {
        try { fs.unlinkSync(WAL_PATH); } catch {}
      }
    } else {
      console.log('[db-sync] No DB found in App Storage, using local');
    }
  } catch (err) {
    console.error('[db-sync] Failed to download DB from App Storage:', err);
  }
}

/**
 * Upload just the WAL file (incremental changes only).
 * Skips if WAL doesn't exist or hasn't changed size since last upload.
 */
export async function uploadWAL(): Promise<void> {
  if (!isReplit) return;

  try {
    if (!fs.existsSync(WAL_PATH)) return;

    const { size } = fs.statSync(WAL_PATH);
    if (size === 0 || size === lastWalSize) return;

    const client = new Client();
    const { ok, error } = await client.uploadFromFilename(REMOTE_WAL_KEY, WAL_PATH);

    if (ok) {
      lastWalSize = size;
      console.log(`[db-sync] Uploaded WAL to App Storage (${size} bytes)`);
    } else {
      console.error('[db-sync] WAL upload failed:', error);
    }
  } catch (err) {
    console.error('[db-sync] Failed to upload WAL:', err);
  }
}

/**
 * Full sync: checkpoint WAL into main DB, upload the main DB,
 * and delete the remote WAL (since its changes are now in the main file).
 */
export async function uploadFullDB(): Promise<void> {
  if (!isReplit) return;

  try {
    const { default: db } = await import('./sqlite.js');

    // Checkpoint WAL into main DB and truncate the WAL file
    db.pragma('wal_checkpoint(TRUNCATE)');

    const { size } = fs.statSync(DB_PATH);
    const client = new Client();
    const { ok, error } = await client.uploadFromFilename(REMOTE_DB_KEY, DB_PATH);

    if (ok) {
      lastWalSize = 0;
      console.log(`[db-sync] Uploaded full DB to App Storage (${size} bytes)`);

      // Delete remote WAL since its changes are now in the main DB
      try { await client.delete(REMOTE_WAL_KEY); } catch {}
    } else {
      console.error('[db-sync] Full DB upload failed:', error);
    }
  } catch (err) {
    console.error('[db-sync] Failed to upload full DB:', err);
  }
}

/**
 * Start periodic syncs:
 *  - WAL upload every 5 minutes (small, incremental)
 *  - Full checkpoint + DB upload every 4 hours
 */
export function startPeriodicSync(): void {
  if (!isReplit) return;

  walTimer = setInterval(() => {
    uploadWAL();
  }, WAL_SYNC_INTERVAL);

  fullTimer = setInterval(() => {
    uploadFullDB();
  }, FULL_SYNC_INTERVAL);

  console.log('[db-sync] Periodic sync started (WAL every 5 min, full every 4 hr)');
}

/**
 * Stop periodic sync and do a final full upload.
 */
export async function stopSync(): Promise<void> {
  if (walTimer) {
    clearInterval(walTimer);
    walTimer = null;
  }
  if (fullTimer) {
    clearInterval(fullTimer);
    fullTimer = null;
  }
  await uploadFullDB();
}
