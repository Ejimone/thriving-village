from django.utils import timezone

from apps.integrations.pubsub import publish

from .models import ActivityLog

ACTIVITY_CHANNEL = "tv:activity"


def log_activity(who: str, what: str, kind: str) -> None:
    """Port of backend/src/utils/activity.ts's logActivity, including the
    `strapi.eventHub.emit('tv.activity', ...)` broadcast half — replaced
    with a Redis Pub/Sub publish (apps/integrations/pubsub.py) so the admin
    SSE stream (Stage 12) sees it from any worker process/instance, not just
    whichever one happened to handle this request."""
    occurred_at = timezone.now()
    ActivityLog.objects.create(who=who, what=what, kind=kind, occurred_at=occurred_at)
    publish(ACTIVITY_CHANNEL, {"who": who, "what": what, "when": occurred_at.isoformat()})
