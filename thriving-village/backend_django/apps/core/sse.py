"""Shared Server-Sent-Events plumbing for the two streams ported from
Strapi (job.ts's `stream` and admin-dashboard.ts's `stream`). Plain Django
views, not DRF — DRF's APIView.finalize_response assumes a DRF Response
object and isn't designed to hand off a StreamingHttpResponse, so these are
built directly on django.views.View, with the same headers/heartbeat/
connected-event shape as the originals.
"""

import json
import time

from django.http import StreamingHttpResponse


def format_event(event: str, data) -> str:
    return f"event: {event}\ndata: {json.dumps(data)}\n\n"


HEARTBEAT_SECONDS = 20


def sse_stream(channel_messages, event_name: str):
    """`channel_messages` is apps.integrations.pubsub.subscribe(channel)'s
    generator (yields a parsed payload dict on a real message, None on each
    ~1s poll tick so a heartbeat can be interleaved)."""
    yield format_event("connected", {"ok": True})
    last_heartbeat = time.monotonic()
    for message in channel_messages:
        if message is not None:
            yield format_event(event_name, message)
        now = time.monotonic()
        if now - last_heartbeat >= HEARTBEAT_SECONDS:
            yield ": ping\n\n"
            last_heartbeat = now


def sse_response(generator) -> StreamingHttpResponse:
    # No explicit `Connection: keep-alive` — it's a hop-by-hop header WSGI
    # servers manage themselves (Django's own dev server rejects an app
    # setting it at all); the streaming body works the same without it.
    response = StreamingHttpResponse(generator, content_type="text/event-stream")
    response["Cache-Control"] = "no-cache"
    response["X-Accel-Buffering"] = "no"
    return response
