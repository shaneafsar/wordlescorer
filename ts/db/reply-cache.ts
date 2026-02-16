import { Client } from '@replit/object-storage';

const CACHE_KEY = 'reply-cache.json';
const MAX_ENTRIES = 5000;
const FLUSH_INTERVAL = 30 * 1000; // 30 seconds
const isReplit = !!process.env['REPL_ID'];

let cache: Set<string> = new Set();
let dirty = false;
let flushTimer: NodeJS.Timeout | null = null;

/**
 * Load the reply cache from App Storage on startup and start periodic flushing.
 */
export async function loadReplyCache(): Promise<void> {
  if (!isReplit) return;

  try {
    const client = new Client();
    const { ok, value } = await client.downloadAsText(CACHE_KEY);

    if (ok && value) {
      const ids: string[] = JSON.parse(value);
      cache = new Set(ids);
      console.log(`[reply-cache] Loaded ${cache.size} entries from App Storage`);
    } else {
      console.log('[reply-cache] No cache found in App Storage, starting fresh');
    }
  } catch (err) {
    console.error('[reply-cache] Failed to load cache:', err);
  }

  // Start periodic flush (every 30s)
  flushTimer = setInterval(() => {
    flushReplyCache();
  }, FLUSH_INTERVAL);
}

/**
 * Check if we've already replied to this post ID.
 */
export function hasReplied(postId: string): boolean {
  return cache.has(postId);
}

/**
 * Mark a post as replied to. Stays in memory until next periodic flush.
 */
export function markReplied(postId: string): void {
  cache.add(postId);
  dirty = true;

  // Evict oldest entries if cache is too large
  if (cache.size > MAX_ENTRIES) {
    const entries = Array.from(cache);
    cache = new Set(entries.slice(entries.length - MAX_ENTRIES));
  }
}

/**
 * Persist the cache to App Storage if it has changed.
 */
export async function flushReplyCache(): Promise<void> {
  if (!isReplit || !dirty) return;

  try {
    const client = new Client();
    const data = JSON.stringify(Array.from(cache));
    const { ok, error } = await client.uploadFromText(CACHE_KEY, data);

    if (ok) {
      dirty = false;
      console.log(`[reply-cache] Flushed ${cache.size} entries to App Storage`);
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
  await flushReplyCache();
}
