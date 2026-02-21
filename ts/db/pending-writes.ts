import { Client } from '@replit/object-storage';

const BATCH_PREFIX = 'pending-writes-';
const FLUSH_INTERVAL = 5 * 60 * 1000; // 5 minutes
const isReplit = !!process.env['REPL_ID'];

interface PendingWrite {
  sql: string;
  params: any[];
}

// Full buffer (for dedup — later writes to same key overwrite earlier ones)
let pending: Map<string, PendingWrite> = new Map();
// Only entries added/changed since last flush
let newEntries: Map<string, PendingWrite> = new Map();
let batchCounter = 0;
let flushTimer: NodeJS.Timeout | null = null;

/**
 * Record a write for crash recovery. Keyed by table+primary key so repeated
 * writes to the same row just overwrite (keeps buffer small).
 */
export function recordWrite(dedupKey: string, sql: string, params: any[]): void {
  if (!isReplit) return;
  const entry = { sql, params };
  pending.set(dedupKey, entry);
  newEntries.set(dedupKey, entry);
}

/**
 * Load pending writes from App Storage and replay them into the DB.
 * Reads all batch files sequentially — later batches win on dedup conflicts.
 */
export async function loadAndReplay(): Promise<void> {
  if (!isReplit) return;

  try {
    const client = new Client();
    const allEntries: [string, PendingWrite][] = [];

    // Load all batch files
    let i = 0;
    while (true) {
      const { ok, value } = await client.downloadAsText(`${BATCH_PREFIX}${i}.json`);
      if (!ok || !value) break;
      const entries: [string, PendingWrite][] = JSON.parse(value);
      allEntries.push(...entries);
      i++;
    }

    // Also check for legacy single-file format
    if (i === 0) {
      const { ok, value } = await client.downloadAsText('pending-writes.json');
      if (ok && value) {
        const entries: [string, PendingWrite][] = JSON.parse(value);
        allEntries.push(...entries);
        // Clean up legacy file
        try { await client.delete('pending-writes.json'); } catch {}
      }
    }

    if (allEntries.length > 0) {
      const { default: db } = await import('./sqlite.js');

      // Dedup: build map so later entries overwrite earlier ones
      const deduped = new Map(allEntries);

      let replayed = 0;
      for (const [, { sql, params }] of deduped) {
        try {
          db.prepare(sql).run(...params);
          replayed++;
        } catch (err) {
          console.error('[pending-writes] Failed to replay write:', err);
        }
      }
      console.log(`[pending-writes] Replayed ${replayed} writes from ${i || 1} batch(es)`);
    } else {
      console.log('[pending-writes] No pending writes found in App Storage');
    }

    batchCounter = i;
  } catch (err) {
    console.error('[pending-writes] Failed to load pending writes:', err);
  }

  // Start periodic flush
  flushTimer = setInterval(() => {
    flushPending();
  }, FLUSH_INTERVAL);
}

/**
 * Flush only new entries since last flush as a separate batch file.
 */
async function flushPending(): Promise<void> {
  if (!isReplit || newEntries.size === 0) return;

  try {
    const client = new Client();
    const data = JSON.stringify(Array.from(newEntries.entries()));
    const key = `${BATCH_PREFIX}${batchCounter}.json`;
    const { ok, error } = await client.uploadFromText(key, data);

    if (ok) {
      console.log(`[pending-writes] Flushed batch ${batchCounter}: ${newEntries.size} entries (${(data.length / 1024).toFixed(1)} KB)`);
      batchCounter++;
      newEntries.clear();
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

  try {
    const client = new Client();
    for (let i = 0; i < batchCounter; i++) {
      try { await client.delete(`${BATCH_PREFIX}${i}.json`); } catch {}
    }
    console.log(`[pending-writes] Cleared ${batchCounter} batch(es) from App Storage`);
  } catch (err) {
    console.error('[pending-writes] Failed to clear from App Storage:', err);
  }

  pending.clear();
  newEntries.clear();
  batchCounter = 0;
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
