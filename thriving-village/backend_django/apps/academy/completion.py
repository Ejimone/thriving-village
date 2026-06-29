"""Port of backend/src/utils/academy-completion.ts. Single choke point for
"on course completion" (ACADEMY_BACKEND_SPEC.md §5.6) — called from both the
daily-submit path (Stage 8) and the cohort-rollout path (Stage 7), since
either can be what pushes current_day to days_total.
"""

from django.utils import timezone

from apps.activity.utils import log_activity

from .models import AcademyCertificate, AcademyEnrollment


def maybe_complete_enrollment(enrollment: AcademyEnrollment, cohort, course) -> None:
    if enrollment.current_day < cohort.days_total:
        return
    if enrollment.status == "Completed":
        return

    AcademyEnrollment.objects.filter(pk=enrollment.pk).update(status="Completed")
    enrollment.status = "Completed"

    if not course.certificate:
        return
    if AcademyCertificate.objects.filter(enrollment=enrollment).exists():
        return

    student_name = enrollment.user.name or enrollment.user.username
    AcademyCertificate.objects.create(
        enrollment=enrollment,
        issued_at=timezone.now(),
        student_name_snapshot=student_name,
        course_title_snapshot=course.title,
        cohort_name_snapshot=cohort.name,
    )

    log_activity(who=student_name, what=f"completed {course.title} and earned a certificate", kind="certificate-issued")
