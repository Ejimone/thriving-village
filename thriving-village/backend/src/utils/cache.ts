import { Redis } from '@upstash/redis';
import { CircuitBreaker } from './circuit-breaker';

const REDIS_TIMEOUT_MS = 1500;

/**
 * Optional — if Upstash creds aren't set (e.g. local dev without them), every
 * call below degrades to "no caching" instead of throwing, so the app still
 * works without Redis configured. `signal` is called fresh per command by the
 * Upstash client, so a hung command aborts (and frees its socket) on its own
 * instead of relying on us to time it out from the outside.
 */
const redis =
  process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN
    ? new Redis({
        url: process.env.UPSTASH_REDIS_REST_URL,
        token: process.env.UPSTASH_REDIS_REST_TOKEN,
        signal: () => AbortSignal.timeout(REDIS_TIMEOUT_MS),
        // The breaker is our resilience layer — the client's own retries would
        // multiply REDIS_TIMEOUT_MS several times over before a call ever
        // surfaces as a failure, defeating the fast-fail goal.
        retry: false,
      })
    : null;

/**
 * Guards every Redis call so that a slow/unreachable Upstash can't pile up
 * in-flight requests across every job/course/contest/admin-dashboard request
 * that touches the cache. Once tripped, callers fall back to "no caching"
 * (see `cached`/`invalidateScope` below) exactly like the unconfigured case.
 */
const breaker = new CircuitBreaker({
  failureThreshold: 5,
  cooldownMs: 15_000,
  halfOpenSuccesses: 2,
  maxConcurrent: 20,
});

function warnOnce(scope: string, err: unknown) {
  const message = err instanceof Error ? err.message : String(err);
  console.warn(`[cache] Redis unavailable for scope "${scope}", bypassing cache: ${message}`);
}

const NAMESPACE = 'tv';

/**
 * Cache-aside read. `scope` groups related keys (e.g. "jobs") so a write to
 * that content type can invalidate every cached read for it at once, without
 * relying on Redis SCAN (Upstash's REST API charges per command and SCAN can
 * be slow/expensive at this layer) — each cached key registers itself in a
 * small per-scope set instead.
 */
export async function cached<T>(
  scope: string,
  key: string,
  ttlSeconds: number,
  fetcher: () => Promise<T>,
): Promise<T> {
  if (!redis) return fetcher();

  const cacheKey = `${NAMESPACE}:${scope}:${key}`;

  try {
    const hit = await breaker.exec(() => redis.get<T>(cacheKey));
    if (hit !== null && hit !== undefined) return hit;
  } catch (err) {
    warnOnce(scope, err);
    return fetcher();
  }

  const value = await fetcher();
  try {
    await breaker.exec(() => redis.set(cacheKey, value, { ex: ttlSeconds }));
    await breaker.exec(() => redis.sadd(`${NAMESPACE}:${scope}:keys`, cacheKey));
  } catch (err) {
    warnOnce(scope, err);
  }
  return value;
}

/** Call after any create/update/delete affecting `scope` so the next read isn't stale. */
export async function invalidateScope(scope: string): Promise<void> {
  if (!redis) return;
  const registryKey = `${NAMESPACE}:${scope}:keys`;
  try {
    const keys = await breaker.exec(() => redis.smembers(registryKey));
    if (keys.length > 0) await breaker.exec(() => redis.del(...keys));
    await breaker.exec(() => redis.del(registryKey));
  } catch (err) {
    warnOnce(scope, err);
    // Skip invalidation — the existing short TTLs bound how stale reads get.
  }
}
