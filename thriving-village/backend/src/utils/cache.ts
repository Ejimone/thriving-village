import { Redis } from '@upstash/redis';

/**
 * Optional — if Upstash creds aren't set (e.g. local dev without them), every
 * call below degrades to "no caching" instead of throwing, so the app still
 * works without Redis configured.
 */
const redis =
  process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN
    ? new Redis({
        url: process.env.UPSTASH_REDIS_REST_URL,
        token: process.env.UPSTASH_REDIS_REST_TOKEN,
      })
    : null;

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
  const hit = await redis.get<T>(cacheKey);
  if (hit !== null && hit !== undefined) return hit;

  const value = await fetcher();
  await redis.set(cacheKey, value, { ex: ttlSeconds });
  await redis.sadd(`${NAMESPACE}:${scope}:keys`, cacheKey);
  return value;
}

/** Call after any create/update/delete affecting `scope` so the next read isn't stale. */
export async function invalidateScope(scope: string): Promise<void> {
  if (!redis) return;
  const registryKey = `${NAMESPACE}:${scope}:keys`;
  const keys = await redis.smembers(registryKey);
  if (keys.length > 0) await redis.del(...keys);
  await redis.del(registryKey);
}
