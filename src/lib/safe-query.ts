/**
 * Runs an optional, non-critical data fetch and turns any failure (a rejected
 * query, a thrown error, a missing table) into `null` so the page that asked
 * for it can render without it. Failures are logged server-side.
 */
export async function orNull<T>(label: string, run: () => Promise<T>): Promise<T | null> {
  try {
    return await run();
  } catch (error) {
    console.error(`[${label}] unavailable:`, error instanceof Error ? error.message : error);
    return null;
  }
}
