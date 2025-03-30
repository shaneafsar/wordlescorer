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
      const err = error as Error; // Ensure `error` is treated as an `Error` object

      if (attempt < retries - 1 && (!shouldRetry || shouldRetry(err))) {
        console.warn(`Retry attempt ${attempt + 1} failed: ${err.message}. Retrying in ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
        delay *= 2; // Exponential backoff
      } else {
        console.error(`Operation failed after ${retries} attempts: ${err.message}`);
        if (defaultValue !== undefined) {
          return defaultValue; // Return default value instead of throwing
        }
        throw err; // Throw the final error if no default value is provided
      }
    }
  }
  throw new Error(`Unexpected retry loop exit`);
}