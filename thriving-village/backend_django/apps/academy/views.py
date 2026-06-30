from django.utils import timezone
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import NotFound, PermissionDenied, ValidationError
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.accounts.models import Role
from apps.accounts.permissions import IsAcademyAdminOrFacilitator, IsAdminRole, IsFacilitatorRole, IsJudgeRole, IsStudentRole
from apps.activity.utils import log_activity
from apps.core.cache import invalidate_scope
from apps.core.exceptions import Conflict
from apps.core.mixins import CachedListMixin, EnvelopeMixin, PkForWriteMixin, UnwrapDataMixin
from apps.integrations.mux_client import create_direct_upload, sign_playback_token, unwrap_webhook_event

from .anon_handle import generate_anon_handle
from .completion import maybe_complete_enrollment
from .models import (
    AcademyApplication,
    AcademyCategory,
    AcademyCertificate,
    AcademyCohort,
    AcademyCourse,
    AcademyEnrollment,
    AcademyJudgment,
    AcademyLiveSession,
    AcademyMaterial,
    AcademyRosterRequest,
    AcademySubmission,
    AcademyTeam,
)
from .progression import ProgressionState, normalize, pace_completion, week_of
from .roster_request import shape_roster_request
from .serializers import (
    AcademyApplicationSerializer,
    AcademyCategorySerializer,
    AcademyCohortSerializer,
    AcademyCohortWriteSerializer,
    AcademyCourseSerializer,
    AcademyCourseWriteSerializer,
    AcademyEnrollmentCreateSerializer,
    AcademyEnrollmentSerializer,
    AcademyLiveSessionSerializer,
    AcademyMaterialSerializer,
    AcademyMaterialWriteSerializer,
    AcademyTeamSerializer,
    CertificateVerifySerializer,
    JudgeQueueItemSerializer,
    OpenCohortSerializer,
    RateSubmissionSerializer,
    RosterEntrySerializer,
    RosterRequestSerializer,
    StudentProfileJudgmentSerializer,
    StudentProfileSubmissionSerializer,
    SubmissionSerializer,
    SubmitTaskSerializer,
    TopRatedEntrySerializer,
)
from .services import apply_to_course, get_open_cohort, promote, rollout_to_week, waitlist_position

ADMIN_WRITE_ACTIONS = ("create", "update", "partial_update", "destroy")


def _time_ago_minutes(value) -> str:
    """Port of academy-submission.ts's `timeAgo` — minute-based bucketing,
    distinct from the day-based one used for jobs/postedAgo elsewhere."""
    from django.utils import timezone as dj_timezone

    minutes = int((dj_timezone.now() - value).total_seconds() // 60)
    if minutes < 60:
        return f"{minutes} min ago"
    hours = minutes // 60
    if hours < 24:
        return f"{hours} hour{'' if hours == 1 else 's'} ago"
    days = hours // 24
    return "yesterday" if days == 1 else f"{days} days ago"


def _time_ago_days(value) -> str:
    """Port of academy-cohort.ts's `timeAgo` — day/week bucketing, distinct
    from `_time_ago_minutes` above (academy-submission.ts's own version)."""
    days = (timezone.now() - value).days
    if days <= 0:
        return "today"
    if days == 1:
        return "1 day ago"
    if days < 7:
        return f"{days} days ago"
    weeks = days // 7
    return "1 week ago" if weeks == 1 else f"{weeks} weeks ago"


def _standing_for(current_day: int, released_week: int) -> str:
    """Port of academy-cohort.ts's `standingFor`."""
    pace = pace_completion(current_day, released_week * 7)
    if pace >= 85:
        return "on-track"
    if pace >= 60:
        return "behind"
    return "at-risk"


def _resolve_transfer_target(source_cohort_id, target_cohort_id):
    """Port of academy-cohort.ts's `resolveTransferTarget` — validates the
    move is legal before any enrollment is touched (same course only — a
    different course's curriculum makes current_day/submitted_days
    meaningless — not into a Completed cohort, not a same-cohort no-op).
    Returns (source_cohort, target_cohort, error_response_or_None)."""
    if not target_cohort_id:
        raise ValidationError("targetCohortId is required.")
    if str(target_cohort_id) == str(source_cohort_id):
        raise ValidationError("Target cohort must be different from the source cohort.")

    source_cohort = AcademyCohort.objects.filter(pk=source_cohort_id).select_related("course").first()
    if not source_cohort:
        raise NotFound("Cohort not found.")
    target_cohort = AcademyCohort.objects.filter(pk=target_cohort_id).select_related("course").first()
    if not target_cohort:
        raise NotFound("Target cohort not found.")
    if target_cohort.course_id != source_cohort.course_id:
        raise ValidationError("Can only transfer to a cohort running the same course.")
    if target_cohort.status == "Completed":
        raise ValidationError("Cannot transfer into a completed cohort.")
    return source_cohort, target_cohort


def _move_enrollment_to_cohort(enrollment, target_cohort):
    """Port of academy-cohort.ts's `moveEnrollmentToCohort` — re-derives
    current_day against the target cohort's own released_week/days_total
    rather than carrying the source cohort's pace over verbatim. removed/
    shortlisted/early_access_requested are cohort-relationship facts, not
    course progress, so they reset on a move."""
    state = ProgressionState(
        current_day=enrollment.current_day,
        submitted_days=enrollment.submitted_days,
        released_week=target_cohort.released_week,
        early_weeks=enrollment.early_weeks,
    )
    next_state = normalize(state, target_cohort.days_total)
    enrollment.cohort = target_cohort
    enrollment.current_day = next_state.current_day
    enrollment.removed = False
    enrollment.shortlisted = False
    enrollment.early_access_requested = False
    enrollment.save(update_fields=["cohort", "current_day", "removed", "shortlisted", "early_access_requested"])
    return enrollment


class AcademyCategoryViewSet(CachedListMixin, EnvelopeMixin, UnwrapDataMixin, PkForWriteMixin, viewsets.ModelViewSet):
    queryset = AcademyCategory.objects.all()
    permission_classes = [AllowAny]
    cache_scope = "academy-categories"

    def get_serializer_class(self):
        return AcademyCategorySerializer

    def get_permissions(self):
        if self.action in ADMIN_WRITE_ACTIONS:
            return [IsAdminRole()]
        return super().get_permissions()

    def perform_create(self, serializer):
        serializer.save()
        invalidate_scope("academy-categories")

    def perform_update(self, serializer):
        serializer.save()
        invalidate_scope("academy-categories")

    def perform_destroy(self, instance):
        instance.delete()
        invalidate_scope("academy-categories")


class AcademyCourseViewSet(CachedListMixin, EnvelopeMixin, UnwrapDataMixin, PkForWriteMixin, viewsets.ModelViewSet):
    queryset = AcademyCourse.objects.select_related("category").all()
    lookup_field = "slug"
    permission_classes = [AllowAny]
    filterset_fields = ["category"]
    cache_scope = "academy-courses"

    def get_serializer_class(self):
        return AcademyCourseWriteSerializer if self.action in ADMIN_WRITE_ACTIONS else AcademyCourseSerializer

    def get_permissions(self):
        if self.action == "apply":
            return [IsStudentRole()]
        if self.action in ADMIN_WRITE_ACTIONS:
            return [IsAdminRole()]
        return super().get_permissions()

    def perform_create(self, serializer):
        serializer.save()
        invalidate_scope("academy-courses")

    def perform_update(self, serializer):
        serializer.save()
        invalidate_scope("academy-courses")

    def perform_destroy(self, instance):
        instance.delete()
        invalidate_scope("academy-courses")

    @action(detail=True, methods=["get"], permission_classes=[AllowAny])
    def curriculum(self, request, slug=None):
        """Outline only (weeks -> days -> has-material flag) — never returns
        material content itself, just enough for the curriculum tree /
        student day-strip to render. Mirrors academy-course.ts's `curriculum`."""
        course = self.get_object()
        authored_days = set(AcademyMaterial.objects.filter(course=course).values_list("day", flat=True))

        weeks = []
        for week in range(1, course.weeks_total + 1):
            days = []
            for d in range(1, 8):
                day = (week - 1) * 7 + d
                if day > course.days_total:
                    break
                days.append({"day": day, "hasMaterial": day in authored_days})
            weeks.append({"week": week, "days": days})

        return Response({"data": {"weeksTotal": course.weeks_total, "daysTotal": course.days_total, "weeks": weeks}})

    @action(detail=True, methods=["get"], permission_classes=[AllowAny], url_path="open-cohort")
    def open_cohort(self, request, slug=None):
        course = self.get_object()
        cohort = get_open_cohort(course)
        if not cohort:
            return Response({"data": None})
        return Response({"data": OpenCohortSerializer(cohort).data})

    @action(detail=True, methods=["post"])
    def apply(self, request, slug=None):
        """Self-serve cohort assignment: the student applies to the course,
        not a cohort directly. apply_to_course() finds the course's
        currently-open cohort and either enrolls immediately (room
        available) or waitlists (full, or none currently open)."""
        course = self.get_object()
        result = apply_to_course(request.user, course)

        if result["outcome"] == "enrolled":
            cohort = result["cohort"]
            return Response(
                {
                    "data": {
                        "status": "enrolled",
                        "enrollmentId": result["enrollment"].id,
                        "cohort": {"id": cohort.id, "name": cohort.name, "startDate": cohort.start_date},
                    }
                },
                status=status.HTTP_201_CREATED,
            )

        return Response(
            {"data": {"status": "waitlisted", "applicationId": result["application"].id, "position": result["position"]}},
            status=status.HTTP_201_CREATED,
        )


class AcademyCohortViewSet(EnvelopeMixin, UnwrapDataMixin, viewsets.ModelViewSet):
    """No public access at all — ADMIN_ACTIONS grants the core CRUD to Admin
    only; facilitators get scoped custom actions (my_cohorts, rollout,
    threshold), never the raw find/findOne/create/update/delete."""

    queryset = AcademyCohort.objects.select_related("course", "course__category", "facilitator").all()
    permission_classes = [IsAdminRole]

    def get_serializer_class(self):
        return AcademyCohortWriteSerializer if self.action in ADMIN_WRITE_ACTIONS else AcademyCohortSerializer

    FACILITATOR_OR_ADMIN_ACTIONS = (
        "roster", "student_profile", "top_rated", "shortlist_toggle", "remove_student", "restore_student",
        "transfer_student", "transfer_bulk", "remove_bulk", "early_access_requests", "roster_request_create",
        "roster_requests_find", "sessions_create", "teams_match", "teams_create", "teams_clear", "teams_get",
    )

    def get_permissions(self):
        if self.action in ("my_cohorts",):
            return [IsFacilitatorRole()]
        if self.action in ("rollout_next_week", "threshold", *self.FACILITATOR_OR_ADMIN_ACTIONS):
            return [IsAcademyAdminOrFacilitator()]
        if self.action == "sessions_find":
            return [IsAuthenticated()]
        return super().get_permissions()

    def perform_create(self, serializer):
        """A freshly created `Enrolling` cohort may immediately absorb a
        pre-existing waitlist for its course (the ALX-style scenario: a prior
        cohort filled up, students waitlisted, this new cohort just opened)."""
        cohort = serializer.save()
        if cohort.status == "Enrolling":
            promote(cohort.course)

    def perform_update(self, serializer):
        """Covers "capacity increased while still open" without diffing
        old/new capacity — promote() is a cheap no-op when there's no room
        or no waitlist, so calling it on every update of an Enrolling cohort
        is a safe superset of "only when capacity increases"."""
        cohort = serializer.save()
        if cohort.status == "Enrolling":
            promote(cohort.course)

    def _assert_facilitator_owns(self, request, cohort):
        if request.user.role == Role.ADMIN:
            return
        if cohort.facilitator_id != request.user.id:
            raise NotFound("Cohort not found.")

    def _assert_cohort_visible(self, request, cohort):
        """Port of academy-cohort.ts's `assertCohortVisible` — admin always;
        facilitator only if they own the cohort; student only if they hold
        a non-removed enrollment in it."""
        if request.user.role == Role.ADMIN:
            return
        if request.user.role == Role.FACILITATOR:
            if cohort.facilitator_id != request.user.id:
                raise PermissionDenied()
            return
        if not AcademyEnrollment.objects.filter(user=request.user, cohort=cohort, removed=False).exists():
            raise PermissionDenied()

    def destroy(self, request, *args, **kwargs):
        """Port of academy-cohort.ts's `delete` — refuses to delete while
        active enrollments exist; cascades sessions/teams (meaningless once
        the cohort is gone), leaves enrollments untouched otherwise."""
        cohort = self.get_object()
        active_count = AcademyEnrollment.objects.filter(cohort=cohort, removed=False).count()
        if active_count > 0:
            raise ValidationError("Remove or transfer all active students before deleting this cohort.")

        AcademyLiveSession.objects.filter(cohort=cohort).delete()
        AcademyTeam.objects.filter(cohort=cohort).delete()
        cohort_name = cohort.name
        cohort.delete()
        log_activity(who="An admin", what=f'deleted cohort "{cohort_name}"', kind="gate-action")
        return Response(status=204)

    @action(detail=False, methods=["get"], url_path="my-cohorts")
    def my_cohorts(self, request):
        cohorts = AcademyCohort.objects.filter(facilitator=request.user).select_related("course", "facilitator")
        return Response({"data": AcademyCohortSerializer(cohorts, many=True).data})

    @action(detail=True, methods=["post"], url_path="rollout-next-week")
    def rollout_next_week(self, request, pk=None):
        cohort = self.get_object()
        self._assert_facilitator_owns(request, cohort)
        updated = rollout_to_week(cohort.id, cohort.released_week + 1)
        return Response({"data": {"releasedWeek": updated.released_week}})

    @action(detail=True, methods=["get", "put"])
    def threshold(self, request, pk=None):
        cohort = self.get_object()
        self._assert_facilitator_owns(request, cohort)
        if request.method == "GET":
            return Response({"data": {"minCompletion": cohort.min_completion, "checkWeeks": cohort.check_weeks}})

        min_completion = request.data.get("minCompletion")
        check_weeks = request.data.get("checkWeeks")
        if min_completion is not None:
            cohort.min_completion = min_completion
        if check_weeks is not None:
            cohort.check_weeks = check_weeks
        cohort.save(update_fields=["min_completion", "check_weeks"])
        return Response({"data": {"minCompletion": cohort.min_completion, "checkWeeks": cohort.check_weeks}})

    # --- Stage 9: facilitator roster tools.

    @action(detail=True, methods=["get"])
    def roster(self, request, pk=None):
        cohort = self.get_object()
        self._assert_facilitator_owns(request, cohort)
        enrollments = AcademyEnrollment.objects.filter(cohort=cohort, removed=False).select_related("user")
        rows = [
            {
                "userId": e.user_id,
                "name": e.user.name or e.user.username,
                "dayReached": e.current_day,
                "lastActive": _time_ago_days(e.updated_at),
                "standing": _standing_for(e.current_day, cohort.released_week),
                "shortlisted": e.shortlisted,
            }
            for e in enrollments
        ]
        return Response({"data": RosterEntrySerializer(rows, many=True).data})

    @action(detail=True, methods=["get"], url_path="students/(?P<uid>[0-9]+)")
    def student_profile(self, request, pk=None, uid=None):
        cohort = self.get_object()
        self._assert_facilitator_owns(request, cohort)
        enrollment = AcademyEnrollment.objects.filter(cohort=cohort, user_id=uid).select_related("user").first()
        if not enrollment:
            raise NotFound("Student not enrolled in this cohort.")

        submissions = AcademySubmission.objects.filter(enrollment=enrollment).order_by("-day")
        judgments = (
            AcademyJudgment.objects.filter(submission__enrollment=enrollment)
            .select_related("submission")
            .order_by("-id")
        )

        return Response(
            {
                "data": {
                    "userId": enrollment.user_id,
                    "name": enrollment.user.name or enrollment.user.username,
                    "dayReached": enrollment.current_day,
                    "standing": _standing_for(enrollment.current_day, cohort.released_week),
                    "submissions": StudentProfileSubmissionSerializer(
                        [
                            {
                                "day": s.day,
                                "task": s.task,
                                "url": s.url,
                                "submittedAgo": _time_ago_minutes(s.submitted_at),
                                "rated": s.rated,
                            }
                            for s in submissions
                        ],
                        many=True,
                    ).data,
                    "judgments": StudentProfileJudgmentSerializer(
                        [
                            {
                                "task": j.submission.task if j.submission else None,
                                "brief": j.brief,
                                "craft": j.craft,
                                "originality": j.originality,
                                "average": float(j.average),
                                "feedback": j.feedback,
                            }
                            for j in judgments
                        ],
                        many=True,
                    ).data,
                }
            }
        )

    @action(detail=True, methods=["get"], url_path="top-rated")
    def top_rated(self, request, pk=None):
        cohort = self.get_object()
        self._assert_facilitator_owns(request, cohort)
        enrollments = AcademyEnrollment.objects.filter(cohort=cohort, removed=False).select_related("user")

        rows = []
        for e in enrollments:
            averages = list(
                AcademyJudgment.objects.filter(submission__enrollment=e).values_list("average", flat=True)
            )
            avg = round((sum(averages) / len(averages)) * 10) / 10 if averages else 0
            rows.append({"userId": e.user_id, "name": e.user.name or e.user.username, "avgScore": float(avg)})

        rows = sorted((r for r in rows if r["avgScore"] > 0), key=lambda r: r["avgScore"], reverse=True)
        return Response({"data": TopRatedEntrySerializer(rows, many=True).data})

    @action(detail=True, methods=["post"], url_path="students/(?P<uid>[0-9]+)/shortlist")
    def shortlist_toggle(self, request, pk=None, uid=None):
        cohort = self.get_object()
        self._assert_facilitator_owns(request, cohort)
        enrollment = AcademyEnrollment.objects.filter(cohort=cohort, user_id=uid).first()
        if not enrollment:
            raise NotFound("Student not enrolled in this cohort.")
        enrollment.shortlisted = not enrollment.shortlisted
        enrollment.save(update_fields=["shortlisted"])
        return Response({"data": {"shortlisted": enrollment.shortlisted}})

    @action(detail=True, methods=["post"], url_path="students/(?P<uid>[0-9]+)/remove")
    def remove_student(self, request, pk=None, uid=None):
        cohort = self.get_object()
        self._assert_facilitator_owns(request, cohort)
        enrollment = AcademyEnrollment.objects.filter(cohort=cohort, user_id=uid).first()
        if not enrollment:
            raise NotFound("Student not enrolled in this cohort.")
        enrollment.removed = True
        enrollment.shortlisted = False
        enrollment.save(update_fields=["removed", "shortlisted"])
        log_activity(who="A facilitator", what="removed a student from the roster", kind="gate-action")
        return Response({"data": {"removed": True}})

    @action(detail=True, methods=["post"], url_path="students/(?P<uid>[0-9]+)/restore")
    def restore_student(self, request, pk=None, uid=None):
        cohort = self.get_object()
        self._assert_facilitator_owns(request, cohort)
        enrollment = AcademyEnrollment.objects.filter(cohort=cohort, user_id=uid).first()
        if not enrollment:
            raise NotFound("Student not enrolled in this cohort.")
        enrollment.removed = False
        enrollment.save(update_fields=["removed"])
        return Response({"data": {"removed": False}})

    @action(detail=True, methods=["post"], url_path="students/(?P<uid>[0-9]+)/transfer")
    def transfer_student(self, request, pk=None, uid=None):
        cohort = self.get_object()
        self._assert_facilitator_owns(request, cohort)
        source_cohort, target_cohort = _resolve_transfer_target(cohort.id, request.data.get("targetCohortId"))

        enrollment = AcademyEnrollment.objects.filter(cohort=cohort, user_id=uid).first()
        if not enrollment:
            raise NotFound("Student not enrolled in this cohort.")
        if AcademyEnrollment.objects.filter(user_id=uid, cohort=target_cohort).exists():
            raise ValidationError("Student already has an enrollment in the target cohort.")

        updated = _move_enrollment_to_cohort(enrollment, target_cohort)
        log_activity(
            who="A facilitator",
            what=f'transferred a student from "{source_cohort.name}" to "{target_cohort.name}"',
            kind="gate-action",
        )
        return Response({"data": {"cohortId": target_cohort.id, "currentDay": updated.current_day}})

    @action(detail=True, methods=["post"], url_path="transfer-bulk")
    def transfer_bulk(self, request, pk=None):
        cohort = self.get_object()
        self._assert_facilitator_owns(request, cohort)
        user_ids = request.data.get("userIds")
        if not isinstance(user_ids, list) or not user_ids:
            raise ValidationError("userIds[] is required.")
        source_cohort, target_cohort = _resolve_transfer_target(cohort.id, request.data.get("targetCohortId"))

        enrollments = AcademyEnrollment.objects.filter(cohort=cohort, user_id__in=user_ids).select_related("user")
        transferred_count = 0
        skipped_user_ids = []
        for e in enrollments:
            if AcademyEnrollment.objects.filter(user_id=e.user_id, cohort=target_cohort).exists():
                skipped_user_ids.append(e.user_id)
                continue
            _move_enrollment_to_cohort(e, target_cohort)
            transferred_count += 1

        log_activity(
            who="A facilitator",
            what=f'transferred {transferred_count} students from "{source_cohort.name}" to "{target_cohort.name}"',
            kind="gate-action",
        )
        return Response({"data": {"transferredCount": transferred_count, "skippedUserIds": skipped_user_ids}})

    @action(detail=True, methods=["post"], url_path="remove-bulk")
    def remove_bulk(self, request, pk=None):
        cohort = self.get_object()
        self._assert_facilitator_owns(request, cohort)
        user_ids = request.data.get("userIds")
        if not isinstance(user_ids, list) or not user_ids:
            raise ValidationError("userIds[] is required.")

        enrollments = AcademyEnrollment.objects.filter(cohort=cohort, user_id__in=user_ids)
        count = enrollments.update(removed=True, shortlisted=False)
        log_activity(who="A facilitator", what=f"removed {count} students at the gate", kind="gate-action")
        return Response({"data": {"removedCount": count}})

    @action(detail=True, methods=["get"], url_path="early-access-requests")
    def early_access_requests(self, request, pk=None):
        cohort = self.get_object()
        self._assert_facilitator_owns(request, cohort)
        enrollments = AcademyEnrollment.objects.filter(
            cohort=cohort, early_access_requested=True, removed=False
        ).select_related("user")
        rows = [
            {
                "enrollmentId": e.id,
                "userId": e.user_id,
                "name": e.user.name or e.user.username,
                "currentDay": e.current_day,
            }
            for e in enrollments
        ]
        return Response({"data": rows})

    @action(detail=True, methods=["post"], url_path="roster-requests")
    def roster_request_create(self, request, pk=None):
        cohort = self.get_object()
        self._assert_facilitator_owns(request, cohort)
        created = AcademyRosterRequest.objects.create(
            cohort=cohort,
            facilitator=request.user,
            count=request.data.get("count"),
            note=request.data.get("note") or "",
            status="Pending",
        )
        created = AcademyRosterRequest.objects.select_related("cohort__course", "facilitator").get(pk=created.pk)
        log_activity(who="A facilitator", what=f'requested more students for "{cohort.name}"', kind="gate-action")
        return Response({"data": RosterRequestSerializer(shape_roster_request(created)).data})

    @roster_request_create.mapping.get
    def roster_requests_find(self, request, pk=None):
        cohort = self.get_object()
        self._assert_facilitator_owns(request, cohort)
        requests = (
            AcademyRosterRequest.objects.filter(cohort=cohort)
            .select_related("cohort__course", "facilitator")
            .order_by("-created_at")
        )
        return Response({"data": [RosterRequestSerializer(shape_roster_request(r)).data for r in requests]})

    @action(detail=True, methods=["get"], url_path="sessions")
    def sessions_find(self, request, pk=None):
        cohort = self.get_object()
        self._assert_cohort_visible(request, cohort)
        sessions = AcademyLiveSession.objects.filter(cohort=cohort)
        return Response({"data": AcademyLiveSessionSerializer(sessions, many=True).data})

    @sessions_find.mapping.post
    def sessions_create(self, request, pk=None):
        cohort = self.get_object()
        self._assert_facilitator_owns(request, cohort)
        required = ("title", "type", "day", "time", "host")
        if not all(request.data.get(f) for f in required):
            raise ValidationError("title, type, day, time, host are required.")
        session = AcademyLiveSession.objects.create(
            cohort=cohort,
            title=request.data["title"],
            type=request.data["type"],
            day=request.data["day"],
            time=request.data["time"],
            host=request.data["host"],
            link=request.data.get("link") or "",
        )
        return Response({"data": AcademyLiveSessionSerializer(session).data})

    @action(detail=True, methods=["post"], url_path="teams/match")
    def teams_match(self, request, pk=None):
        from .progression import chunk

        cohort = self.get_object()
        self._assert_facilitator_owns(request, cohort)
        size = int(request.data.get("teamSize") or 3)

        AcademyTeam.objects.filter(cohort=cohort).delete()
        enrollments = AcademyEnrollment.objects.filter(cohort=cohort, removed=False).select_related("user")
        groups = chunk([e.user_id for e in enrollments], size)
        week = cohort.released_week or 1
        title = request.data.get("title") or f"Week {week} group project"

        teams = []
        for member_ids in groups:
            team = AcademyTeam.objects.create(cohort=cohort, week=week, title=title)
            team.members.set(member_ids)
            teams.append(team)

        log_activity(who="A facilitator", what=f"matched {len(teams)} teams", kind="team-match")
        return Response({"data": [_shape_team(t) for t in teams]})

    @action(detail=True, methods=["post"], url_path="teams")
    def teams_create(self, request, pk=None):
        cohort = self.get_object()
        self._assert_facilitator_owns(request, cohort)
        title = request.data.get("title")
        member_user_ids = request.data.get("memberUserIds")
        if not title:
            raise ValidationError("title is required.")
        if not isinstance(member_user_ids, list) or not member_user_ids:
            raise ValidationError("memberUserIds[] is required.")

        conflicting = set(
            AcademyTeam.objects.filter(cohort=cohort, members__id__in=member_user_ids)
            .values_list("members__id", flat=True)
        )
        conflicting &= set(member_user_ids)
        if conflicting:
            raise ValidationError(
                f"These students are already on another team in this cohort: {', '.join(map(str, conflicting))}"
            )

        team = AcademyTeam.objects.create(cohort=cohort, week=request.data.get("week") or cohort.released_week or 1, title=title)
        team.members.set(member_user_ids)
        log_activity(who="A facilitator", what=f'created team "{title}"', kind="team-match")
        return Response({"data": _shape_team(team)})

    @action(detail=True, methods=["post"], url_path="teams/clear")
    def teams_clear(self, request, pk=None):
        cohort = self.get_object()
        self._assert_facilitator_owns(request, cohort)
        AcademyTeam.objects.filter(cohort=cohort).delete()
        log_activity(who="A facilitator", what="cleared teams", kind="team-match")
        return Response({"data": {"cleared": True}})

    @teams_create.mapping.get
    def teams_get(self, request, pk=None):
        cohort = self.get_object()
        self._assert_facilitator_owns(request, cohort)
        teams = AcademyTeam.objects.filter(cohort=cohort).prefetch_related("members")
        return Response({"data": [_shape_team(t) for t in teams]})


def _shape_team(team) -> dict:
    return {
        "id": team.id,
        "week": team.week,
        "title": team.title,
        "members": [
            {"id": m.id, "name": m.name or m.username, "email": m.email, "whatsapp": m.whatsapp}
            for m in team.members.all()
        ],
    }


def _can_access_course_material(user, course_id) -> bool:
    """Port of academy-material.ts's canAccessCourseMaterial."""
    if user.role == Role.ADMIN:
        return True
    if user.role == Role.FACILITATOR:
        return AcademyCohort.objects.filter(course_id=course_id, facilitator=user).exists()
    return AcademyEnrollment.objects.filter(removed=False, cohort__course_id=course_id, user=user).exists()


class AcademyMaterialView(APIView):
    """GET/PUT/DELETE /api/academy-courses/:course_id/days/:day/material —
    mirrors academy-material.ts's find/put/delete."""

    permission_classes = [IsAuthenticated]

    def get(self, request, course_id, day):
        if not _can_access_course_material(request.user, course_id):
            raise PermissionDenied()
        material = AcademyMaterial.objects.filter(course_id=course_id, day=day).first()
        # Per spec: unauthored material returns null, never 404 — the client
        # decides whether to fall back to a generated placeholder.
        if not material:
            return Response({"data": None})
        return Response({"data": AcademyMaterialSerializer(material).data})

    def put(self, request, course_id, day):
        if request.user.role not in (Role.ADMIN, Role.FACILITATOR) or not _can_access_course_material(request.user, course_id):
            raise PermissionDenied()
        serializer = AcademyMaterialWriteSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        material, _ = AcademyMaterial.objects.update_or_create(course_id=course_id, day=day, defaults=data)
        return Response({"data": AcademyMaterialSerializer(material).data})

    def delete(self, request, course_id, day):
        if request.user.role not in (Role.ADMIN, Role.FACILITATOR) or not _can_access_course_material(request.user, course_id):
            raise PermissionDenied()
        AcademyMaterial.objects.filter(course_id=course_id, day=day).delete()
        return Response({"data": {"deleted": True}})


class AcademyMaterialMuxUploadUrlView(APIView):
    """POST /api/academy-courses/:course_id/days/:day/mux-upload-url —
    mirrors academy-material.ts's `muxUploadUrl`. Same write gate as
    AcademyMaterialView.put (admin/facilitator-with-cohort-on-this-course)."""

    permission_classes = [IsAuthenticated]

    def post(self, request, course_id, day):
        if request.user.role not in (Role.ADMIN, Role.FACILITATOR) or not _can_access_course_material(request.user, course_id):
            raise PermissionDenied()
        upload = create_direct_upload()
        AcademyMaterial.objects.update_or_create(course_id=course_id, day=day, defaults={"mux_upload_id": upload["id"]})
        return Response({"data": {"uploadUrl": upload["url"], "uploadId": upload["id"]}})


class AcademyMaterialPlaybackTokenView(APIView):
    """GET /api/academy-courses/:course_id/days/:day/playback-token —
    mirrors academy-material.ts's `getPlaybackToken`. Same read gate as
    AcademyMaterialView.get."""

    permission_classes = [IsAuthenticated]

    def get(self, request, course_id, day):
        if not _can_access_course_material(request.user, course_id):
            raise PermissionDenied()
        material = AcademyMaterial.objects.filter(course_id=course_id, day=day).first()
        if not material or not material.mux_playback_id:
            raise NotFound("No video for this lesson.")
        return Response({"data": {"token": sign_playback_token(material.mux_playback_id), "playbackId": material.mux_playback_id}})


class MuxWebhookView(APIView):
    """POST /webhooks/mux — public (Mux-signature-verified, not session-
    authenticated), port of mux-webhook.ts's `handle`. Only acts on
    `video.asset.ready`, matching every other content-type Mux can manage —
    this app only ever creates assets for AcademyMaterial uploads."""

    permission_classes = [AllowAny]
    authentication_classes = []

    def post(self, request):
        signature_header = request.headers.get("Mux-Signature", "")
        try:
            event = unwrap_webhook_event(request.body, signature_header)
        except ValueError:
            return Response({"error": "Invalid Mux webhook signature."}, status=401)

        if event.get("type") == "video.asset.ready":
            data = event.get("data", {})
            playback_ids = data.get("playback_ids") or []
            AcademyMaterial.objects.filter(mux_upload_id=data.get("upload_id")).update(
                mux_asset_id=data.get("id"),
                mux_playback_id=playback_ids[0]["id"] if playback_ids else "",
            )

        return Response({"received": True})


class AcademyEnrollmentViewSet(EnvelopeMixin, UnwrapDataMixin, viewsets.ModelViewSet):
    """find/findOne/delete/create only (no update via the core route).
    create is admin-only — there is no student self-enroll flow for the
    Academy (ACADEMY_STUDENT_ACTIONS has no `academy-enrollment.create`).
    Students see only their own rows; Admin sees all — mirrors
    loadVisibleEnrollment/scopedFind in academy-enrollment.ts."""

    http_method_names = ["get", "post", "delete", "head", "options"]
    permission_classes = [IsAuthenticated]

    def get_serializer_class(self):
        return AcademyEnrollmentCreateSerializer if self.action == "create" else AcademyEnrollmentSerializer

    def get_queryset(self):
        qs = AcademyEnrollment.objects.select_related(
            "user", "cohort", "cohort__course", "cohort__course__category", "cohort__facilitator"
        )
        if self.request.user.role == Role.ADMIN:
            return qs
        return qs.filter(user=self.request.user)

    def get_permissions(self):
        if self.action == "create":
            return [IsAdminRole()]
        if self.action == "request_early_access":
            return [IsStudentRole()]
        if self.action in ("submit_task", "submissions", "team"):
            return [IsStudentRole()]
        if self.action == "grant_early_access":
            return [IsAcademyAdminOrFacilitator()]
        return super().get_permissions()

    def destroy(self, request, *args, **kwargs):
        enrollment = self.get_object()
        if request.user.role != Role.ADMIN:
            raise PermissionDenied()
        from .models import AcademyCertificate

        has_submissions = enrollment.submissions.exists()
        has_certificate = AcademyCertificate.objects.filter(enrollment=enrollment).exists()
        if has_submissions or has_certificate:
            raise ValidationError("This enrollment has submissions or a certificate attached and cannot be deleted.")
        enrollment.delete()
        return Response(status=204)

    def _load_own_enrollment(self, request, pk):
        """Strict: the daily-flow actions (submit/list/request-early-access/
        team) only ever make sense as "my own enrollment" — no admin bypass."""
        enrollment = (
            AcademyEnrollment.objects.select_related("user", "cohort", "cohort__course")
            .filter(pk=pk, user=request.user)
            .first()
        )
        if not enrollment:
            raise NotFound("Enrollment not found.")
        return enrollment

    def _load_enrollment_for_facilitator(self, request, pk):
        """Facilitator/admin-scoped loader for grant_early_access — same
        "don't reveal existence to a non-owner" pattern as
        AcademyCohortViewSet._assert_facilitator_owns (404, not 403)."""
        enrollment = (
            AcademyEnrollment.objects.select_related("user", "cohort", "cohort__course")
            .filter(pk=pk)
            .first()
        )
        if not enrollment:
            raise NotFound("Enrollment not found.")
        if request.user.role != Role.ADMIN:
            if request.user.role != Role.FACILITATOR or enrollment.cohort.facilitator_id != request.user.id:
                raise NotFound("Enrollment not found.")
        return enrollment

    @action(detail=True, methods=["post"], url_path="request-early-access")
    def request_early_access(self, request, pk=None):
        enrollment = self._load_own_enrollment(request, pk)
        enrollment.early_access_requested = True
        enrollment.save(update_fields=["early_access_requested"])

        log_activity(
            who=enrollment.user.name or enrollment.user.username,
            what="requested early access to the next week",
            kind="early-access",
        )
        return Response({"data": {"earlyAccessRequested": True}})

    @action(detail=True, methods=["post"], url_path="submit-task")
    def submit_task(self, request, pk=None):
        enrollment = self._load_own_enrollment(request, pk)
        serializer = SubmitTaskSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        # Never trust a client-supplied day past validation — a student can
        # only ever submit *today's* task, never an arbitrary future day.
        if data["day"] != enrollment.current_day:
            raise ValidationError("You can only submit today's task.")

        cohort = enrollment.cohort
        course = cohort.course

        AcademySubmission.objects.create(
            enrollment=enrollment,
            day=enrollment.current_day,
            week=week_of(enrollment.current_day),
            task=f"Day {enrollment.current_day} task",
            course_title=course.title,
            url=data["url"],
            note=data.get("note", ""),
            submitted_at=timezone.now(),
            rated=False,
            anon_handle=generate_anon_handle(),
        )

        submitted_days = enrollment.submitted_days if enrollment.current_day in enrollment.submitted_days else [
            *enrollment.submitted_days,
            enrollment.current_day,
        ]

        state = ProgressionState(
            current_day=enrollment.current_day,
            submitted_days=submitted_days,
            released_week=cohort.released_week,
            early_weeks=enrollment.early_weeks,
        )
        next_state = normalize(state, cohort.days_total)

        enrollment.submitted_days = submitted_days
        enrollment.current_day = next_state.current_day
        enrollment.save(update_fields=["submitted_days", "current_day"])

        maybe_complete_enrollment(enrollment, cohort, course)
        log_activity(
            who=enrollment.user.name or enrollment.user.username,
            what=f"submitted day {enrollment.current_day} of {course.title}",
            kind="gate-action",
        )

        return Response(
            {
                "data": {
                    "currentDay": next_state.current_day,
                    "submittedDays": submitted_days,
                    "releasedWeek": cohort.released_week,
                    "earlyWeeks": enrollment.early_weeks,
                }
            }
        )

    @action(detail=True, methods=["get"])
    def submissions(self, request, pk=None):
        enrollment = self._load_own_enrollment(request, pk)
        rows = AcademySubmission.objects.filter(enrollment=enrollment).order_by("-day")
        return Response({"data": SubmissionSerializer(rows, many=True).data})

    @action(detail=True, methods=["get"])
    def team(self, request, pk=None):
        """GET .../academy-enrollments/:id/team — the student's own
        teammates for their current group assignment, excluding self."""
        enrollment = self._load_own_enrollment(request, pk)
        team = (
            AcademyTeam.objects.filter(cohort=enrollment.cohort, members=enrollment.user)
            .prefetch_related("members")
            .first()
        )
        if not team:
            return Response({"data": None})
        members = [m for m in team.members.all() if m.id != enrollment.user_id]
        return Response(
            {"data": [{"id": m.id, "name": m.name or m.username, "email": m.email, "whatsapp": m.whatsapp} for m in members]}
        )

    @action(detail=True, methods=["post"], url_path="grant-early-access")
    def grant_early_access(self, request, pk=None):
        """Facilitator/admin approval half of the request→grant flow (the
        student-side request_early_access action only sets a flag — this is
        the part that actually unlocks the next week). Adds exactly
        `released_week + 1` to earlyWeeks (not a range) and immediately
        advances currentDay if the student was caught up, via the same
        ProgressionState/normalize logic submit_task uses."""
        enrollment = self._load_enrollment_for_facilitator(request, pk)
        cohort = enrollment.cohort

        new_week = cohort.released_week + 1
        early_weeks = enrollment.early_weeks if new_week in enrollment.early_weeks else [*enrollment.early_weeks, new_week]

        state = ProgressionState(
            current_day=enrollment.current_day,
            submitted_days=enrollment.submitted_days,
            released_week=cohort.released_week,
            early_weeks=early_weeks,
        )
        next_state = normalize(state, cohort.days_total)

        enrollment.early_access_requested = False
        enrollment.early_weeks = early_weeks
        enrollment.current_day = next_state.current_day
        enrollment.save(update_fields=["early_access_requested", "early_weeks", "current_day"])

        log_activity(
            who=enrollment.user.name or enrollment.user.username,
            what="was granted early access to the next week",
            kind="early-access",
        )
        return Response({"data": {"earlyWeeks": enrollment.early_weeks, "currentDay": enrollment.current_day}})


class MyAcademyApplicationsView(APIView):
    """GET /me/academy-applications — dashboard state for a student with no
    enrollment yet: "you applied to X, you're #3 on the waitlist." Position
    is live-computed per row, not stored."""

    permission_classes = [IsStudentRole]

    def get(self, request):
        rows = AcademyApplication.objects.filter(user=request.user).select_related("course").order_by("-created_at")
        data = [
            {
                "id": a.id,
                "status": a.status,
                "position": waitlist_position(a) if a.status == "Waitlisted" else None,
                "course": {"id": a.course.id, "title": a.course.title, "slug": a.course.slug},
                "createdAt": a.created_at,
            }
            for a in rows
        ]
        return Response({"data": AcademyApplicationSerializer(data, many=True).data})


class CancelAcademyApplicationView(APIView):
    """POST /academy-applications/:id/cancel — self only, no admin bypass
    (mirrors AcademyEnrollmentViewSet._load_own_enrollment's strictness)."""

    permission_classes = [IsStudentRole]

    def post(self, request, pk):
        application = AcademyApplication.objects.filter(pk=pk, user=request.user).first()
        if not application:
            raise NotFound("Application not found.")
        if application.status != "Waitlisted":
            raise Conflict("This application can no longer be cancelled.")

        application.status = "Cancelled"
        application.save(update_fields=["status"])
        return Response({"data": {"status": application.status}})


class AcademyJudgingView(APIView):
    """GET /academy-judging/queue, POST /academy-judging/:id/rate — judge-only.
    Anonymity is a hard rule (ACADEMY_BACKEND_SPEC.md §7): the queue query
    NEVER populates `enrollment` (the relation chain that leads back to
    user/cohort) — `course_title`/`anon_handle` are denormalized onto the
    submission specifically so this endpoint never needs to touch identity.
    """

    permission_classes = [IsJudgeRole]


class JudgeQueueView(AcademyJudgingView):
    def get(self, request):
        submissions = (
            AcademySubmission.objects.filter(rated=False)
            .order_by("submitted_at")
            .values("id", "day", "week", "task", "course_title", "url", "note", "submitted_at", "anon_handle")[:50]
        )
        items = [
            {
                "id": s["anon_handle"],
                "submissionId": s["id"],
                "course": s["course_title"],
                "task": s["task"],
                "week": s["week"],
                "submittedAgo": _time_ago_minutes(s["submitted_at"]),
                "url": s["url"],
                "note": s["note"] or "",
            }
            for s in submissions
        ]
        return Response({"data": JudgeQueueItemSerializer(items, many=True).data})


class RateSubmissionView(AcademyJudgingView):
    def post(self, request, pk):
        submission = AcademySubmission.objects.filter(pk=pk).only("id", "rated").first()
        if not submission:
            raise NotFound("Submission not found.")
        if submission.rated:
            raise Conflict("This submission has already been rated.")
        if AcademyJudgment.objects.filter(submission_id=pk, judge=request.user).exists():
            raise Conflict("You have already rated this submission.")

        serializer = RateSubmissionSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        average = round(((data["brief"] + data["craft"] + data["originality"]) / 3) * 10) / 10
        judgment = AcademyJudgment.objects.create(
            submission_id=pk,
            judge=request.user,
            brief=data["brief"],
            craft=data["craft"],
            originality=data["originality"],
            average=average,
            feedback=data["feedback"],
        )

        AcademySubmission.objects.filter(pk=pk).update(rated=True)

        # Never name the judge here, even to admins — keep the activity
        # feed's anonymized phrasing consistent with the original mock data.
        log_activity(who="A judge", what="rated a submission", kind="judgment")

        return Response({"data": {"average": float(judgment.average)}})


class CertificateVerifyView(APIView):
    """GET /academy-certificates/verify/:code — public, port of
    academy-certificate.ts's `verify`."""

    permission_classes = [AllowAny]

    def get(self, request, code):
        certificate = AcademyCertificate.objects.filter(verification_code=code).first()
        if not certificate:
            raise NotFound("No certificate found for this code.")
        return Response({"data": CertificateVerifySerializer(certificate).data})


class AcademyTeamViewSet(viewsets.GenericViewSet):
    """rename/delete/add-member/remove-member only — named distinctly from
    the default core update/delete actions (rather than overriding them) so
    an unrelated, unpermissioned default route never becomes a second,
    unguarded path to the same effect. Facilitator-or-admin only; ownership
    is enforced via the team's cohort, mirroring academy-team.ts."""

    queryset = AcademyTeam.objects.select_related("cohort").prefetch_related("members")
    permission_classes = [IsAcademyAdminOrFacilitator]

    def _assert_owns(self, request, team):
        if request.user.role == Role.ADMIN:
            return
        if team.cohort.facilitator_id != request.user.id:
            raise NotFound("Team not found.")

    @action(detail=True, methods=["put"], url_path="rename")
    def rename_team(self, request, pk=None):
        team = self.get_object()
        self._assert_owns(request, team)
        title = request.data.get("title")
        if not title:
            raise ValidationError("title is required.")
        team.title = title
        team.save(update_fields=["title"])
        return Response({"data": {"id": team.id, "title": team.title}})

    def destroy(self, request, *args, **kwargs):
        team = self.get_object()
        self._assert_owns(request, team)
        team.delete()
        return Response(status=204)

    @action(detail=True, methods=["post"], url_path="members")
    def add_member(self, request, pk=None):
        team = self.get_object()
        self._assert_owns(request, team)
        user_id = request.data.get("userId")
        if not user_id:
            raise ValidationError("userId is required.")
        user_id = int(user_id)

        if team.members.filter(id=user_id).exists():
            return Response({"data": _shape_team(team)})

        conflicting = AcademyTeam.objects.filter(cohort=team.cohort, members__id=user_id).exclude(pk=team.pk).exists()
        if conflicting:
            raise ValidationError("This student is already on another team in this cohort.")

        team.members.add(user_id)
        return Response({"data": _shape_team(team)})

    @action(detail=True, methods=["delete"], url_path="members/(?P<user_id>[0-9]+)")
    def remove_member(self, request, pk=None, user_id=None):
        team = self.get_object()
        self._assert_owns(request, team)
        team.members.remove(int(user_id))
        return Response({"data": _shape_team(team)})


class RosterRequestStatusView(APIView):
    """PUT /academy-roster-requests/:id/status — admin-only, port of
    academy-roster-request.ts's `updateStatus`."""

    permission_classes = [IsAdminRole]
    ADMIN_SETTABLE_STATUSES = ("Fulfilled", "Dismissed")

    def put(self, request, pk):
        status_value = request.data.get("status")
        if status_value not in self.ADMIN_SETTABLE_STATUSES:
            raise ValidationError(f"status must be one of: {', '.join(self.ADMIN_SETTABLE_STATUSES)}")

        request_obj = AcademyRosterRequest.objects.filter(pk=pk).select_related("cohort__course", "facilitator").first()
        if not request_obj:
            raise NotFound("Roster request not found.")

        request_obj.status = status_value
        request_obj.save(update_fields=["status"])
        return Response({"data": RosterRequestSerializer(shape_roster_request(request_obj)).data})
