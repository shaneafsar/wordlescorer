import { Client } from '@replit/object-storage';

const STORAGE_KEY = 'pending-writes.json';
const FLUSH_INTERVAL = 5 * 60 * 1000; // 5 minutes
const isReplit = !!process.env['REPL_ID'];

interface PendingWrite {
  sql: string;
  params: any[];
}

let pending: Map<string, PendingWrite> = new Map();
let dirty = false;
let lastFlushedSize = 0;
let flushTimer: NodeJS.Timeout | null = null;

/**
 * Record a write for crash recovery. Keyed by table+primary key so repeated
 * writes to the same row just overwrite (keeps buffer small).
 */
export function recordWrite(dedupKey: string, sql: string, params: any[]): void {
  if (!isReplit) return;
  pending.set(dedupKey, { sql, params });
  dirty = true;
}

/**
 * Load pending writes from App Storage and replay them into the DB.
 * Called on startup after downloadDB() but before the app starts processing.
 */
export async function loadAndReplay(): Promise<void> {
  if (!isReplit) return;

  try {
    const client = new Client();
    const { ok, value } = await client.downloadAsText(STORAGE_KEY);

    if (ok && value) {
      const entries: [string, PendingWrite][] = JSON.parse(value);

      if (entries.length > 0) {
        // Dynamic import to avoid loading sqlite.ts before DB is downloaded
        const { default: db } = await import('./sqlite.js');

        let replayed = 0;
        for (const [, { sql, params }] of entries) {
          try {
            db.prepare(sql).run(...params);
            replayed++;
          } catch (err) {
            console.error('[pending-writes] Failed to replay write:', err);
          }
        }
        console.log(`[pending-writes] Replayed ${replayed}/${entries.length} pending writes`);
      }
    } else {
      console.log('[pending-writes] No pending writes found in App Storage');
    }
  } catch (err) {
    console.error('[pending-writes] Failed to load pending writes:', err);
  }

  // Start periodic flush (every 30s)
  flushTimer = setInterval(() => {
    flushPending();
  }, FLUSH_INTERVAL);
}

/**
 * Persist pending writes to App Storage if dirty.
 */
async function flushPending(): Promise<void> {
  if (!isReplit || !dirty) return;

  try {
    const client = new Client();
    const data = JSON.stringify(Array.from(pending.entries()));

    // Skip upload if buffer content hasn't changed size (dedup overwrites)
    if (data.length === lastFlushedSize) {
      dirty = false;
      return;
    }

    const { ok, error } = await client.uploadFromText(STORAGE_KEY, data);

    if (ok) {
      dirty = false;
      lastFlushedSize = data.length;
      console.log(`[pending-writes] Flushed ${pending.size} entries to App Storage (${(data.length / 1024).toFixed(1)} KB)`);
    } else {
      console.error('[pending-writes] Flush failed:', error);
    }
  } catch (err) {
    console.error('[pending-writes] Failed to flush:', err);
  }
}

/**
 * Clear the pending writes buffer. Called after a successful DB upload
 * (those writes are now baked into the uploaded DB file).
 */
export async function clearPending(): Promise<void> {
  if (!isReplit) return;

  pending.clear();
  dirty = false;
  lastFlushedSize = 0;

  try {
    const client = new Client();
    await client.delete(STORAGE_KEY);
    console.log('[pending-writes] Cleared pending writes from App Storage');
  } catch (err) {
    console.error('[pending-writes] Failed to clear from App Storage:', err);
  }
}

/**
 * Stop periodic flushing and do a final flush.
 */
export async function stopPendingWrites(): Promise<void> {
  if (flushTimer) {
    clearInterval(flushTimer);
    flushTimer = null;
  }
  await flushPending();
}
