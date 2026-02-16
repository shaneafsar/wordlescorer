import { Client } from '@replit/object-storage';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, '..', '..', 'data');
const DB_PATH = process.env['SQLITE_DB_PATH'] || path.join(DATA_DIR, 'wordlescorer.db');
const REMOTE_KEY = 'wordlescorer.db';
const SYNC_INTERVAL = 15 * 60 * 1000; // 15 minutes

let syncTimer: NodeJS.Timeout | null = null;
const isReplit = !!process.env['REPL_ID'];

/**
 * Download the DB from Replit App Storage to the local filesystem.
 * Must be called BEFORE sqlite.ts is imported (which opens the DB on import).
 */
export async function downloadDB(): Promise<void> {
  if (!isReplit) return;

  // Ensure data directory exists
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }

  try {
    const client = new Client();
    const { ok } = await client.downloadToFilename(REMOTE_KEY, DB_PATH);

    if (ok) {
      // Remove stale WAL/SHM files since we have a fresh main DB
      try { fs.unlinkSync(DB_PATH + '-wal'); } catch {}
      try { fs.unlinkSync(DB_PATH + '-shm'); } catch {}

      const size = fs.statSync(DB_PATH).size;
      console.log(`[db-sync] Downloaded DB from App Storage (${size} bytes)`);
    } else {
      console.log('[db-sync] No DB found in App Storage, using local');
    }
  } catch (err) {
    console.error('[db-sync] Failed to download DB from App Storage:', err);
  }
}

/**
 * Upload the current DB to Replit App Storage.
 * Imports sqlite.ts lazily to checkpoint WAL before uploading.
 */
export async function uploadDB(): Promise<void> {
  if (!isReplit) return;

  try {
    // Dynamically import to avoid circular dependency / early DB open
    const { default: db } = await import('./sqlite.js');

    // Checkpoint WAL into main DB so we upload a complete file
    db.pragma('wal_checkpoint(TRUNCATE)');

    const client = new Client();
    const { ok, error } = await client.uploadFromFilename(REMOTE_KEY, DB_PATH);

    if (ok) {
      const size = fs.statSync(DB_PATH).size;
      console.log(`[db-sync] Uploaded DB to App Storage (${size} bytes)`);
    } else {
      console.error('[db-sync] Upload failed:', error);
    }
  } catch (err) {
    console.error('[db-sync] Failed to upload DB to App Storage:', err);
  }
}

/**
 * Start periodic uploads every 15 minutes.
 */
export function startPeriodicSync(): void {
  if (!isReplit) return;

  syncTimer = setInterval(() => {
    uploadDB();
  }, SYNC_INTERVAL);

  console.log('[db-sync] Periodic sync started (every 15 min)');
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
