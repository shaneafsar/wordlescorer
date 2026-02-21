import { Client } from '@replit/object-storage';

const CACHE_KEY = 'reply-cache.json';
const KV_PREFIX = 'rc:';
const MAX_ENTRIES = 5000;
const FLUSH_INTERVAL = 30 * 1000; // 30 seconds (only used for Object Storage fallback)

let cache: Set<string> = new Set();

// Object Storage fallback state
let dirty = false;
let flushTimer: NodeJS.Timeout | null = null;

// Replit KV store (null = not available, use Object Storage fallback)
let kvDb: any = null;

/**
 * Load the reply cache on startup.
 * Uses Replit KV store if available, falls back to Object Storage.
 */
export async function loadReplyCache(): Promise<void> {
  // Try Replit KV store first
  if (process.env['REPLIT_DB_URL']) {
    try {
      const Database = (await import('@replit/database')).default;
      kvDb = new Database();
      const keys: string[] = await kvDb.list(KV_PREFIX);
      for (const key of keys) {
        cache.add(key.slice(KV_PREFIX.length));
      }
      console.log(`[reply-cache] Loaded ${cache.size} entries from Replit KV`);

      // Migrate from Object Storage if KV was empty but Object Storage has data
      if (cache.size === 0) {
        try {
          const client = new Client();
          const { ok, value } = await client.downloadAsText(CACHE_KEY);
          if (ok && value) {
            const ids: string[] = JSON.parse(value);
            for (const id of ids) {
              cache.add(id);
              await kvDb.set(`${KV_PREFIX}${id}`, 1);
            }
            await client.delete(CACHE_KEY);
            console.log(`[reply-cache] Migrated ${ids.length} entries from Object Storage to KV`);
          }
        } catch {}
      }
      return;
    } catch (err) {
      console.error('[reply-cache] Failed to init Replit KV, falling back to Object Storage:', err);
      kvDb = null;
    }
  }

  // Fallback: Object Storage
  if (process.env['REPL_ID']) {
    try {
      const client = new Client();
      const { ok, value } = await client.downloadAsText(CACHE_KEY);
      if (ok && value) {
        const ids: string[] = JSON.parse(value);
        cache = new Set(ids);
        console.log(`[reply-cache] Loaded ${cache.size} entries from Object Storage`);
      } else {
        console.log('[reply-cache] No cache found, starting fresh');
      }
    } catch (err) {
      console.error('[reply-cache] Failed to load cache:', err);
    }

    flushTimer = setInterval(() => {
      flushReplyCache();
    }, FLUSH_INTERVAL);
  }
}

/**
 * Check if we've already replied to this post ID.
 */
export function hasReplied(postId: string): boolean {
  return cache.has(postId);
}

/**
 * Mark a post as replied to.
 * With KV: persists immediately. With Object Storage: batched flush.
 */
export function markReplied(postId: string): void {
  cache.add(postId);

  if (kvDb) {
    // Write to KV immediately (fire-and-forget)
    kvDb.set(`${KV_PREFIX}${postId}`, 1).catch((err: any) => {
      console.error('[reply-cache] KV write failed:', err);
    });

    // Evict oldest if over limit (KV has 5,000 key limit)
    if (cache.size > MAX_ENTRIES) {
      const entries = Array.from(cache);
      const toDelete = entries.slice(0, entries.length - MAX_ENTRIES);
      cache = new Set(entries.slice(entries.length - MAX_ENTRIES));
      for (const id of toDelete) {
        kvDb.delete(`${KV_PREFIX}${id}`).catch(() => {});
      }
    }
  } else {
    dirty = true;
    if (cache.size > MAX_ENTRIES) {
      const entries = Array.from(cache);
      cache = new Set(entries.slice(entries.length - MAX_ENTRIES));
    }
  }
}

/**
 * Persist the cache to Object Storage (fallback only).
 */
export async function flushReplyCache(): Promise<void> {
  if (kvDb || !process.env['REPL_ID'] || !dirty) return;

  try {
    const client = new Client();
    const data = JSON.stringify(Array.from(cache));
    const { ok, error } = await client.uploadFromText(CACHE_KEY, data);

    if (ok) {
      dirty = false;
      console.log(`[reply-cache] Flushed ${cache.size} entries to Object Storage`);
    } else {
      console.error('[reply-cache] Flush failed:', error);
    }
  } catch (err) {
    console.error('[reply-cache] Failed to flush cache:', err);
  }
}

/**
 * Stop periodic flushing and do a final flush.
 */
export async function stopReplyCache(): Promise<void> {
  if (flushTimer) {
    clearInterval(flushTimer);
    flushTimer = null;
  }
  // Only needed for Object Storage fallback
  if (!kvDb) {
    await flushReplyCache();
  }
}
