import threading

from django.utils import timezone

from apps.integrations.pubsub import publish

from .models import ActivityLog

ACTIVITY_CHANNEL = "tv:activity"


def log_activity(who: str, what: str, kind: str) -> None:
    """Port of backend/src/utils/activity.ts's logActivity.

    Runs off the request thread so the caller's response is not blocked by
    the DB insert + Redis publish. Activity logging is best-effort: a failure
    here should never surface as a 500 to the user.
    """
    occurred_at = timezone.now()

    def _log():
        try:
            ActivityLog.objects.create(who=who, what=what, kind=kind, occurred_at=occurred_at)
            publish(ACTIVITY_CHANNEL, {"who": who, "what": what, "when": occurred_at.isoformat()})
        except Exception:  # noqa: BLE001
            pass

    threading.Thread(target=_log, daemon=True).start()
