/** Strip HTML tags and decode common entities (replaces jsdom usage) */
export function stripHtml(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&#x27;/g, "'")
    .replace(/&nbsp;/g, ' ');
}

/** Format a Date as YYYY-MM-DD in UTC */
export function getDateKey(date: Date): string {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-${String(date.getUTCDate()).padStart(2, '0')}`;
}

/** Returns true if d1 and d2 share the same UTC day */
export function checkIsSameDay(d1: Date | string, d2: Date = new Date()): boolean {
  if (typeof d1 === 'string') {
    d1 = new Date(d1);
  }
  return d1.getUTCDate() === d2.getUTCDate() &&
    d1.getUTCMonth() === d2.getUTCMonth() &&
    d1.getUTCFullYear() === d2.getUTCFullYear();
}

/** Retry a function with exponential backoff */
export async function retry<T>(
  fn: () => Promise<T>,
  retries: number = 3,
  delay: number = 1000,
  shouldRetry?: (error: any) => boolean,
  defaultValue?: T
): Promise<T> {
  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      const err = error as Error;
      if (attempt < retries - 1 && (!shouldRetry || shouldRetry(err))) {
        console.warn(`Retry attempt ${attempt + 1} failed: ${err.message}. Retrying in ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
        delay *= 2;
      } else {
        console.error(`Operation failed after ${retries} attempts: ${err.message}`);
        if (defaultValue !== undefined) {
          return defaultValue;
        }
        throw err;
      }
    }
  }
  throw new Error('Unexpected retry loop exit');
}
