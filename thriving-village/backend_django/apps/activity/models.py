from django.db import models

KIND_CHOICES = [
    (k, k)
    for k in [
        "application", "entry", "enrollment", "save", "rollout", "early-access",
        "gate-action", "judgment", "team-match", "certificate-issued", "contest-result",
    ]
]


class ActivityLog(models.Model):
    """Ported 1:1 from backend/src/api/activity-log/content-types/activity-log/schema.json."""

    who = models.CharField(max_length=255)
    what = models.CharField(max_length=255)
    kind = models.CharField(max_length=30, choices=KIND_CHOICES)
    occurred_at = models.DateTimeField()

    class Meta:
        ordering = ["-occurred_at"]

    def __str__(self):
        return f"{self.who} {self.what}"
