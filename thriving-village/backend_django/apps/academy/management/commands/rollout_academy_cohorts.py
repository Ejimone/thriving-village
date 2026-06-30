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
from apps.academy.services import promote, rollout_to_week

logger = logging.getLogger(__name__)


class Command(BaseCommand):
    help = "Auto-advance each active Academy cohort's released_week, close cohorts past their start date, and sweep waitlists."

    def handle(self, *args, **options):
        today = timezone.now().date()

        # Close cohorts whose start date has arrived *before* the waitlist
        # sweep below runs, so a cohort crossing its start date in this run
        # stops accepting new applicants in the same pass.
        closed = AcademyCohort.objects.filter(status="Enrolling", start_date__lte=today).update(status="Running")
        if closed:
            self.stdout.write(f"Closed {closed} cohort(s) that reached their start date")

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

        # Safety-net sweep: pull waitlisted applications into any cohort that
        # still has room, for every course with a currently-open cohort.
        for cohort in AcademyCohort.objects.filter(status="Enrolling").select_related("course"):
            try:
                promoted = promote(cohort.course)
                if promoted:
                    self.stdout.write(f"Promoted {promoted} waitlisted application(s) for {cohort.course.title}")
            except Exception as err:  # noqa: BLE001
                logger.error("[rollout_academy_cohorts] promote failed for course %s: %s", cohort.course_id, err)
