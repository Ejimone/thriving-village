"""Port of backend/src/api/academy-cohort/services/academy-cohort.ts."""

from django.db import transaction
from django.db.models import Count, IntegerField, OuterRef, Subquery

from apps.activity.utils import log_activity
from apps.core.exceptions import Conflict

from .completion import maybe_complete_enrollment
from .models import AcademyApplication, AcademyCohort, AcademyEnrollment
from .progression import ProgressionState, normalize

ALREADY_APPLIED_MESSAGE = "You've already applied to this course."


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

    enrollments = list(AcademyEnrollment.objects.filter(cohort_id=cohort_id, removed=False).select_related("user"))
    advanced = []
    for enrollment in enrollments:
        state = ProgressionState(
            current_day=enrollment.current_day,
            submitted_days=enrollment.submitted_days or [],
            released_week=released_week,
            early_weeks=enrollment.early_weeks or [],
        )
        next_state = normalize(state, cohort.days_total)
        if next_state.current_day != enrollment.current_day:
            enrollment.current_day = next_state.current_day
            advanced.append(enrollment)
    # One UPDATE for the whole cohort instead of one per advanced student —
    # this runs inside the daily cron tick across every running cohort.
    if advanced:
        AcademyEnrollment.objects.bulk_update(advanced, ["current_day"], batch_size=500)
    for enrollment in enrollments:
        maybe_complete_enrollment(enrollment, cohort, cohort.course)

    log_activity(who="System", what=f"rolled out week {released_week} for {cohort.name}", kind="rollout")
    return cohort


# --- Self-serve cohort assignment: a student applies to a course, not a
# cohort directly. apply_to_course() finds that course's currently-open
# ("Enrolling") cohort and either enrolls immediately (room available) or
# waitlists (full, or none currently open) — FIFO by AcademyApplication.created_at.


def get_open_cohort(course) -> AcademyCohort | None:
    return AcademyCohort.objects.filter(course=course, status="Enrolling").order_by("start_date").first()


def seats_remaining(cohort) -> int | None:
    if cohort.capacity is None:
        return None
    enrolled = AcademyEnrollment.objects.filter(cohort=cohort, removed=False).count()
    return max(0, cohort.capacity - enrolled)


def waitlist_position(application: AcademyApplication) -> int:
    return AcademyApplication.objects.filter(
        course=application.course, status="Waitlisted", created_at__lte=application.created_at
    ).count()


def with_waitlist_positions(qs):
    """Annotates each application with `waitlist_position` (same definition
    as waitlist_position() above) in the one list query, instead of a COUNT
    round trip per row — the admin applications view was paying one extra
    query per waitlisted application."""
    position = (
        AcademyApplication.objects.filter(
            course=OuterRef("course"), status="Waitlisted", created_at__lte=OuterRef("created_at")
        )
        .order_by()
        .values("course")
        .annotate(n=Count("pk"))
        .values("n")
    )
    return qs.annotate(waitlist_position=Subquery(position, output_field=IntegerField()))


def apply_to_course(user, course) -> dict:
    if AcademyEnrollment.objects.filter(user=user, cohort__course=course, removed=False).exists():
        raise Conflict(ALREADY_APPLIED_MESSAGE)
    if AcademyApplication.objects.filter(user=user, course=course, status="Waitlisted").exists():
        raise Conflict(ALREADY_APPLIED_MESSAGE)

    with transaction.atomic():
        cohort = (
            AcademyCohort.objects.select_for_update()
            .filter(course=course, status="Enrolling")
            .order_by("start_date")
            .first()
        )
        if cohort:
            enrolled = AcademyEnrollment.objects.filter(cohort=cohort, removed=False).count()
            if cohort.capacity is None or enrolled < cohort.capacity:
                enrollment = AcademyEnrollment.objects.create(user=user, cohort=cohort, status="Starting soon")
                log_activity(
                    who=user.name or user.username, what=f"was auto-enrolled in {course.title}", kind="application"
                )
                return {"outcome": "enrolled", "cohort": cohort, "enrollment": enrollment}

        application = AcademyApplication.objects.create(user=user, course=course, status="Waitlisted")
        log_activity(who=user.name or user.username, what=f"was waitlisted for {course.title}", kind="application")
        return {"outcome": "waitlisted", "application": application, "position": waitlist_position(application)}


def promote(course) -> int:
    """Pulls Waitlisted applications for `course` into its currently-open
    cohort, oldest first, up to remaining capacity. Called after a cohort
    opens/grows, and as a daily safety-net sweep (rollout_academy_cohorts)."""
    with transaction.atomic():
        cohort = (
            AcademyCohort.objects.select_for_update()
            .filter(course=course, status="Enrolling")
            .order_by("start_date")
            .first()
        )
        if not cohort:
            return 0
        remaining = seats_remaining(cohort)
        if remaining is not None and remaining <= 0:
            return 0

        qs = AcademyApplication.objects.filter(course=course, status="Waitlisted").order_by("created_at")
        if remaining is not None:
            qs = qs[:remaining]

        promoted = 0
        for application in qs:
            AcademyEnrollment.objects.create(user=application.user, cohort=cohort, status="Starting soon")
            application.status = "Enrolled"
            application.save(update_fields=["status"])
            promoted += 1

        if promoted:
            log_activity(who="System", what=f"promoted {promoted} waitlisted student(s) into {cohort.name}", kind="application")
        return promoted
