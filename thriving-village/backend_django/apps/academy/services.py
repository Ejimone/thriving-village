"""Port of backend/src/api/academy-cohort/services/academy-cohort.ts."""

from apps.activity.utils import log_activity

from .completion import maybe_complete_enrollment
from .models import AcademyCohort, AcademyEnrollment
from .progression import ProgressionState, normalize


def rollout_to_week(cohort_id: int, target_week: int) -> AcademyCohort | None:
    """Bumps `released_week` up to `target_week` (clamped to `weeks_total`)
    and auto-advances every caught-up enrollment into the newly released
    week(s). Shared by the manual rollout action and the daily cron tick so
    both code paths apply identical progression rules."""
    cohort = AcademyCohort.objects.filter(pk=cohort_id).select_related("course").first()
    if not cohort:
        return None

    released_week = max(cohort.released_week, min(cohort.weeks_total, target_week))
    if released_week == cohort.released_week:
        return cohort

    AcademyCohort.objects.filter(pk=cohort_id).update(released_week=released_week)
    cohort.released_week = released_week

    enrollments = AcademyEnrollment.objects.filter(cohort_id=cohort_id, removed=False).select_related("user")
    for enrollment in enrollments:
        state = ProgressionState(
            current_day=enrollment.current_day,
            submitted_days=enrollment.submitted_days or [],
            released_week=released_week,
            early_weeks=enrollment.early_weeks or [],
        )
        next_state = normalize(state, cohort.days_total)
        if next_state.current_day != enrollment.current_day:
            AcademyEnrollment.objects.filter(pk=enrollment.pk).update(current_day=next_state.current_day)
            enrollment.current_day = next_state.current_day
        maybe_complete_enrollment(enrollment, cohort, cohort.course)

    log_activity(who="System", what=f"rolled out week {released_week} for {cohort.name}", kind="rollout")
    return cohort
