import { Client } from '@replit/object-storage';

const CACHE_KEY = 'reply-cache.json';
const MAX_ENTRIES = 5000;
const isReplit = !!process.env['REPL_ID'];

let cache: Set<string> = new Set();
let dirty = false;

/**
 * Load the reply cache from App Storage on startup.
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
}

/**
 * Check if we've already replied to this post ID.
 */
export function hasReplied(postId: string): boolean {
  return cache.has(postId);
}

/**
 * Mark a post as replied to and persist to App Storage.
 */
export async function markReplied(postId: string): Promise<void> {
  cache.add(postId);
  dirty = true;

  // Evict oldest entries if cache is too large
  if (cache.size > MAX_ENTRIES) {
    const entries = Array.from(cache);
    cache = new Set(entries.slice(entries.length - MAX_ENTRIES));
  }

  await flushReplyCache();
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
    } else {
      console.error('[reply-cache] Flush failed:', error);
    }
  } catch (err) {
    console.error('[reply-cache] Failed to flush cache:', err);
  }
}
