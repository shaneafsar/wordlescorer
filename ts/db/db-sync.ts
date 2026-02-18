import { Client } from '@replit/object-storage';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, '..', '..', 'data');
const DB_PATH = process.env['SQLITE_DB_PATH'] || path.join(DATA_DIR, 'wordlescorer.db');
const REMOTE_DB_KEY = 'wordlescorer.db';

const SYNC_INTERVAL = 12 * 60 * 60 * 1000; // 12 hours

let syncTimer: NodeJS.Timeout | null = null;
let lastUploadSize: number = 0;
const isReplit = !!process.env['REPL_ID'];

/**
 * Download the DB from Replit App Storage.
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
      // Remove stale WAL/SHM — SQLite recreates them on open
      try { fs.unlinkSync(DB_PATH + '-wal'); } catch {}
      try { fs.unlinkSync(DB_PATH + '-shm'); } catch {}

      const size = fs.statSync(DB_PATH).size;
      console.log(`[db-sync] Downloaded DB from App Storage (${size} bytes)`);

      // Also clean up the remote WAL key if it exists (legacy cleanup)
      try { await client.delete('wordlescorer.db-wal'); } catch {}
    } else {
      console.log('[db-sync] No DB found in App Storage, using local');
    }
  } catch (err) {
    console.error('[db-sync] Failed to download DB from App Storage:', err);
  }
}

/**
 * Checkpoint WAL into main DB and upload the single DB file.
 * Skips upload if the DB size hasn't changed since last upload.
 */
export async function uploadDB(): Promise<void> {
  if (!isReplit) return;

  try {
    const { default: db } = await import('./sqlite.js');

    // Checkpoint WAL into main DB so we upload a single consistent file
    db.pragma('wal_checkpoint(TRUNCATE)');

    const { size } = fs.statSync(DB_PATH);
    if (size === lastUploadSize) return;

    const client = new Client();
    const { ok, error } = await client.uploadFromFilename(REMOTE_DB_KEY, DB_PATH);

    if (ok) {
      lastUploadSize = size;
      console.log(`[db-sync] Uploaded DB to App Storage (${size} bytes)`);
    } else {
      console.error('[db-sync] DB upload failed:', error);
    }
  } catch (err) {
    console.error('[db-sync] Failed to upload DB:', err);
  }
}

/**
 * Start periodic sync: checkpoint + upload every 5 minutes.
 */
export function startPeriodicSync(): void {
  if (!isReplit) return;

  syncTimer = setInterval(() => {
    uploadDB();
  }, SYNC_INTERVAL);

  console.log('[db-sync] Periodic sync started (every 12 hr)');
}

/**
 * Stop periodic sync and do a final upload.
 */
export async function stopSync(): Promise<void> {
  if (syncTimer) {
    clearInterval(syncTimer);
    syncTimer = null;
  }
  await uploadDB();
}
