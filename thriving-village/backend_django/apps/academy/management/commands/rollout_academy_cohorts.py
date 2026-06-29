"""Port of backend/config/cron-tasks.ts's 'academy-weekly-rollout' task.

Run daily, e.g. via a DigitalOcean App Platform Scheduled Job
(`python manage.py rollout_academy_cohorts`, cron expression `0 1 * * *` to
match the original's "daily at 01:00 server time") — deliberately not a
Celery beat task; this app has no other recurring-job need yet that would
justify running a broker/worker just for this one daily tick.
"""

import logging
import math

from django.core.management.base import BaseCommand
from django.utils import timezone

from apps.academy.models import AcademyCohort
from apps.academy.services import rollout_to_week

logger = logging.getLogger(__name__)


class Command(BaseCommand):
    help = "Auto-advance each active Academy cohort's released_week to match elapsed time since its start_date."

    def handle(self, *args, **options):
        cohorts = AcademyCohort.objects.filter(status__in=["Enrolling", "Running"])
        now = timezone.now()

        for cohort in cohorts:
            try:
                elapsed_days = (now.date() - cohort.start_date).days
                expected_week = min(cohort.weeks_total, max(1, math.ceil(elapsed_days / 7)))
                if expected_week > cohort.released_week:
                    rollout_to_week(cohort.id, expected_week)
                    self.stdout.write(f"Rolled out cohort {cohort.id} ({cohort.name}) to week {expected_week}")
            except Exception as err:  # noqa: BLE001
                logger.error("[rollout_academy_cohorts] failed for cohort %s: %s", cohort.id, err)
