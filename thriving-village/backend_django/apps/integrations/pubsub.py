"""Redis Pub/Sub replacement for Strapi's in-process `strapi.eventHub`
(backend/src/utils/activity.ts's `eventHub.emit('tv.activity', ...)` and
job.ts's `eventHub.emit('tv.job.created', ...)`). An in-process event emitter
only works because Strapi is a single process; Django/gunicorn on DO App
Platform can run multiple worker processes/instances, so the SSE views in
apps/*/sse_views.py need a broadcast mechanism every process can see —
that's Redis Pub/Sub, backed by the same Upstash instance the cache already
uses (raw redis-py client here, not django-redis's cache wrapper, since
Django's cache framework has no Pub/Sub concept).

Degrades to a no-op publisher when UPSTASH_REDIS_URL is unset (local dev
without Redis) — same "never let this be a hard requirement" rule
apps/core/cache.py follows. Without Redis, SSE connections still serve
`connected` + heartbeats; they just never receive a broadcast.
"""

import json
import logging

from django.conf import settings

logger = logging.getLogger(__name__)

_client = None
_client_checked = False


def _get_client():
    global _client, _client_checked
    if _client_checked:
        return _client
    _client_checked = True
    if not settings.UPSTASH_REDIS_URL:
        return None
    import redis

    _client = redis.from_url(settings.UPSTASH_REDIS_URL)
    return _client


def publish(channel: str, payload: dict) -> None:
    client = _get_client()
    if not client:
        return
    try:
        client.publish(channel, json.dumps(payload))
    except Exception as err:  # noqa: BLE001
        logger.warning('[pubsub] publish to "%s" failed, dropping event: %s', channel, err)


def subscribe(channel: str):
    """Generator yielding parsed payload dicts published to `channel`.
    Blocks on `get_message` with a short timeout so the caller (an SSE view)
    can interleave heartbeats and a connection-close check between
    messages — yields nothing (just loops) when Redis isn't configured, so
    the SSE view still serves heartbeats forever without erroring."""
    client = _get_client()
    if not client:
        import time

        while True:
            time.sleep(1.0)
            yield None
        return

    pubsub = client.pubsub()
    pubsub.subscribe(channel)
    try:
        while True:
            message = pubsub.get_message(timeout=1.0)
            if message and message.get("type") == "message":
                try:
                    yield json.loads(message["data"])
                except (TypeError, ValueError):
                    continue
            else:
                yield None
    finally:
        pubsub.unsubscribe(channel)
        pubsub.close()
