"""Port of backend/src/utils/cache.ts's cache-aside pattern onto django-redis.

Same per-scope key-registry approach (a Redis Set of keys per scope) so a
write to one content type can invalidate every cached read for it without an
expensive SCAN — same reasoning Strapi's version documents, kept here even
though Django talks to Upstash over the standard protocol (not the
REST API), since the registry approach is just as cheap either way and
avoids depending on `delete_pattern`'s SCAN cost at any Redis tier.

Degrades to "no caching" (calls the fetcher directly) whenever Redis is
unavailable/unconfigured (LocMemCache in local dev) or the circuit breaker is
open — mirrors the original's "never let caching block the request" rule.
"""

import logging

from django.core.cache import cache

from apps.integrations.circuit_breaker import BulkheadRejectedError, CircuitBreaker, CircuitOpenError

logger = logging.getLogger(__name__)

NAMESPACE = "tv"

_breaker = CircuitBreaker(failure_threshold=5, cooldown_seconds=15, half_open_successes=2, max_concurrent=20)


def _raw_redis():
    """Raw redis-py client when django-redis backs the cache, else None.

    The key registry is a *set* semantically — SADD/SMEMBERS/DEL are atomic
    and O(1) per member, whereas the portable fallback (get the whole pickled
    set, union, set it back) is a read-modify-write race under concurrency
    and re-serializes the entire registry on every cache write.
    """
    try:
        from django_redis import get_redis_connection

        return get_redis_connection("default")
    except Exception:  # noqa: BLE001 — LocMemCache in local dev
        return None


def _warn_once(scope: str, err: Exception) -> None:
    logger.warning('[cache] Redis unavailable for scope "%s", bypassing cache: %s', scope, err)


def cached(scope: str, key: str, ttl_seconds: int, fetcher):
    """Cache-aside read. `fetcher` is a zero-arg callable returning the value
    to cache on a miss.
    """
    cache_key = f"{NAMESPACE}:{scope}:{key}"

    try:
        hit = _breaker.exec(lambda: cache.get(cache_key))
        if hit is not None:
            return hit
    except (CircuitOpenError, BulkheadRejectedError, Exception) as err:  # noqa: BLE001
        _warn_once(scope, err)
        return fetcher()

    value = fetcher()
    registry_key = f"{NAMESPACE}:{scope}:keys"
    try:
        _breaker.exec(lambda: cache.set(cache_key, value, ttl_seconds))
        redis = _raw_redis()
        if redis is not None:
            _breaker.exec(lambda: redis.sadd(registry_key, cache_key))
        else:
            _breaker.exec(lambda: cache.set(registry_key, set(cache.get(registry_key) or set()) | {cache_key}, None))
    except (CircuitOpenError, BulkheadRejectedError, Exception) as err:  # noqa: BLE001
        _warn_once(scope, err)
    return value


def invalidate_scope(scope: str) -> None:
    """Call after any create/update/delete affecting `scope` so the next read isn't stale."""
    registry_key = f"{NAMESPACE}:{scope}:keys"
    try:
        redis = _raw_redis()
        if redis is not None:
            keys = _breaker.exec(lambda: redis.smembers(registry_key))
            if keys:
                _breaker.exec(lambda: cache.delete_many([k.decode() if isinstance(k, bytes) else k for k in keys]))
            _breaker.exec(lambda: redis.delete(registry_key))
            return
        keys = _breaker.exec(lambda: cache.get(registry_key))
        if keys:
            _breaker.exec(lambda: cache.delete_many(list(keys)))
        _breaker.exec(lambda: cache.delete(registry_key))
    except (CircuitOpenError, BulkheadRejectedError, Exception) as err:  # noqa: BLE001
        _warn_once(scope, err)
        # Skip invalidation — the existing short TTLs bound how stale reads get.
