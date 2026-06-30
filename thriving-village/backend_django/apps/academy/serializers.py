from rest_framework import serializers

from apps.core.mixins import DocumentIdMixin
from apps.core.slugs import slugify, unique_slug

from .models import (
    AcademyCategory,
    AcademyCertificate,
    AcademyCohort,
    AcademyCourse,
    AcademyEnrollment,
    AcademyJudgment,
    AcademyLiveSession,
    AcademyMaterial,
    AcademySubmission,
)
from .services import seats_remaining


class AcademyCategorySerializer(DocumentIdMixin, serializers.ModelSerializer):
    class Meta:
        model = AcademyCategory
        fields = ["id", "name", "slug", "blurb"]
        extra_kwargs = {"slug": {"required": False}}

    def create(self, validated_data):
        if not validated_data.get("slug"):
            validated_data["slug"] = unique_slug(AcademyCategory, slugify(validated_data["name"]))
        return super().create(validated_data)


class AcademyCourseSerializer(DocumentIdMixin, serializers.ModelSerializer):
    category = serializers.PrimaryKeyRelatedField(read_only=True)
    categorySlug = serializers.CharField(source="category.slug", read_only=True)
    weeksTotal = serializers.IntegerField(source="weeks_total")
    daysTotal = serializers.IntegerField(source="days_total")

    class Meta:
        model = AcademyCourse
        fields = ["id", "title", "slug", "category", "categorySlug", "months", "certificate", "weeksTotal", "daysTotal"]


class AcademyCourseWriteSerializer(DocumentIdMixin, serializers.ModelSerializer):
    weeksTotal = serializers.IntegerField(source="weeks_total")
    daysTotal = serializers.IntegerField(source="days_total")

    class Meta:
        model = AcademyCourse
        fields = ["id", "title", "slug", "category", "months", "certificate", "weeksTotal", "daysTotal"]
        extra_kwargs = {"slug": {"required": False}}

    def create(self, validated_data):
        if not validated_data.get("slug"):
            validated_data["slug"] = unique_slug(AcademyCourse, slugify(validated_data["title"]))
        return super().create(validated_data)


class FacilitatorSerializer(serializers.Serializer):
    id = serializers.IntegerField()
    name = serializers.CharField()


class AcademyCohortSerializer(DocumentIdMixin, serializers.ModelSerializer):
    """`facilitator` is shaped to {id, name} only — mirrors
    backend/src/api/academy-cohort/controllers/academy-cohort.ts's
    `shapeFacilitator`, never exposing email/whatsapp/role here. `course` is
    nested (full AcademyCourseSerializer shape, not a bare id) so callers
    can read `cohort.course.title`/`.category` without a second fetch."""

    facilitator = serializers.SerializerMethodField()
    course = serializers.SerializerMethodField()
    weeksTotal = serializers.IntegerField(source="weeks_total")
    daysTotal = serializers.IntegerField(source="days_total")
    startDate = serializers.DateField(source="start_date")
    releasedWeek = serializers.IntegerField(source="released_week")
    minCompletion = serializers.IntegerField(source="min_completion")
    checkWeeks = serializers.JSONField(source="check_weeks")

    class Meta:
        model = AcademyCohort
        fields = [
            "id", "name", "course", "facilitator", "weeksTotal", "daysTotal", "startDate",
            "status", "releasedWeek", "minCompletion", "checkWeeks", "capacity",
        ]

    def get_facilitator(self, obj):
        if not obj.facilitator_id:
            return None
        return {"id": obj.facilitator.id, "name": obj.facilitator.name or obj.facilitator.username}

    def get_course(self, obj):
        return AcademyCourseSerializer(obj.course).data


class AcademyCohortWriteSerializer(DocumentIdMixin, serializers.ModelSerializer):
    weeksTotal = serializers.IntegerField(source="weeks_total")
    daysTotal = serializers.IntegerField(source="days_total")
    startDate = serializers.DateField(source="start_date")
    releasedWeek = serializers.IntegerField(source="released_week", required=False)
    minCompletion = serializers.IntegerField(source="min_completion", required=False)
    checkWeeks = serializers.JSONField(source="check_weeks", required=False)
    capacity = serializers.IntegerField(required=False, allow_null=True)

    class Meta:
        model = AcademyCohort
        fields = [
            "id", "name", "course", "facilitator", "weeksTotal", "daysTotal", "startDate",
            "status", "releasedWeek", "minCompletion", "checkWeeks", "capacity",
        ]


class OpenCohortSerializer(DocumentIdMixin, serializers.Serializer):
    """Backs GET .../open-cohort — the course-page "Cohort 8, starts July 14,
    12 seats left" lookup students see before they apply."""

    id = serializers.IntegerField()
    name = serializers.CharField()
    startDate = serializers.DateField(source="start_date")
    capacity = serializers.IntegerField(allow_null=True)
    seatsLeft = serializers.SerializerMethodField()

    def get_seatsLeft(self, obj):
        return seats_remaining(obj)


class AcademyMaterialSerializer(serializers.ModelSerializer):
    """Mux fields are deliberately omitted — same intent as Strapi's
    `private: true` on mux_upload_id/mux_asset_id/mux_playback_id. A
    `hasVideoPlayback` boolean substitutes for `muxPlaybackId` itself, same
    as the original controller's `find` action."""

    externalVideoUrl = serializers.URLField(source="external_video_url", required=False, allow_blank=True)
    taskDetail = serializers.CharField(source="task_detail", required=False, allow_blank=True)
    hasVideoPlayback = serializers.SerializerMethodField()

    class Meta:
        model = AcademyMaterial
        fields = ["text", "externalVideoUrl", "task", "taskDetail", "docs", "hasVideoPlayback"]

    def get_hasVideoPlayback(self, obj):
        return bool(obj.mux_playback_id)


class AcademyMaterialWriteSerializer(serializers.Serializer):
    text = serializers.CharField(required=False, allow_blank=True)
    videoUrl = serializers.URLField(required=False, allow_blank=True, source="external_video_url")
    task = serializers.CharField(required=False, allow_blank=True)
    taskDetail = serializers.CharField(required=False, allow_blank=True, source="task_detail")
    docs = serializers.JSONField(required=False)


class AcademyEnrollmentSerializer(serializers.ModelSerializer):
    """`cohort` is nested (full AcademyCohortSerializer shape, which itself
    nests `course`) so `enrollment.cohort.name`/`.course.title` are readable
    without a second fetch — same reasoning as AcademyCohortSerializer.course."""

    currentDay = serializers.IntegerField(source="current_day")
    submittedDays = serializers.JSONField(source="submitted_days")
    earlyAccessRequested = serializers.BooleanField(source="early_access_requested")
    earlyWeeks = serializers.JSONField(source="early_weeks")
    cohort = serializers.SerializerMethodField()

    class Meta:
        model = AcademyEnrollment
        fields = [
            "id", "user", "cohort", "status", "currentDay", "submittedDays",
            "earlyAccessRequested", "earlyWeeks", "removed", "shortlisted",
        ]

    def get_cohort(self, obj):
        return AcademyCohortSerializer(obj.cohort).data


class AcademyEnrollmentCreateSerializer(serializers.ModelSerializer):
    """Admin-only — there is no student self-enroll flow for the Academy
    (confirmed: ACADEMY_STUDENT_ACTIONS in backend/src/index.ts has no
    `academy-enrollment.create`; only Admin gets it). Who's enrolled is an
    admin/roster decision, unlike the marketplace's self-serve enroll."""

    class Meta:
        model = AcademyEnrollment
        fields = ["id", "user", "cohort", "status"]


class AcademyApplicationSerializer(serializers.Serializer):
    """Backs GET /me/academy-applications — built from plain dicts the view
    assembles (course nested, position live-computed), same convention as
    RosterEntrySerializer below."""

    id = serializers.IntegerField()
    status = serializers.CharField()
    position = serializers.IntegerField(allow_null=True)
    course = serializers.DictField()
    createdAt = serializers.DateTimeField()


class AcademyAdminApplicationSerializer(serializers.Serializer):
    """Backs GET /academy-admin/applications — admin-wide view, adds `user`
    alongside the same course/position/createdAt shape."""

    id = serializers.IntegerField()
    status = serializers.CharField()
    position = serializers.IntegerField(allow_null=True)
    user = serializers.DictField()
    course = serializers.DictField()
    createdAt = serializers.DateTimeField()


# --- Stage 8: submissions + judging + anonymity.

class SubmitTaskSerializer(serializers.Serializer):
    day = serializers.IntegerField()
    url = serializers.URLField()
    note = serializers.CharField(required=False, allow_blank=True, default="")


class SubmissionSerializer(serializers.ModelSerializer):
    """Used by listSubmissions (the student's own view of their work) —
    distinct from the judge queue serializer below, which never includes
    `enrollment` at all."""

    submittedAt = serializers.DateTimeField(source="submitted_at")

    class Meta:
        model = AcademySubmission
        fields = ["id", "day", "week", "task", "url", "note", "submittedAt", "rated"]


class JudgeQueueItemSerializer(serializers.Serializer):
    """Judge anonymity is a hard rule (ACADEMY_BACKEND_SPEC.md §7) — this
    serializer's fields are an explicit allow-list with NO path to
    `enrollment`/`user`/`cohort`, by construction (it's a plain Serializer
    over a dict, not a ModelSerializer over the AcademySubmission instance,
    so there's no `instance.enrollment` ever reachable from here even by
    accident)."""

    id = serializers.CharField()  # the anon handle, not the submission's real id
    submissionId = serializers.IntegerField()
    course = serializers.CharField()
    task = serializers.CharField()
    week = serializers.IntegerField()
    submittedAgo = serializers.CharField()
    url = serializers.CharField()
    note = serializers.CharField()


class RateSubmissionSerializer(serializers.Serializer):
    brief = serializers.IntegerField(min_value=0, max_value=10)
    craft = serializers.IntegerField(min_value=0, max_value=10)
    originality = serializers.IntegerField(min_value=0, max_value=10)
    feedback = serializers.CharField()


# --- Stage 9: certificates + facilitator roster tools.

class CertificateVerifySerializer(serializers.ModelSerializer):
    studentNameSnapshot = serializers.CharField(source="student_name_snapshot")
    courseTitleSnapshot = serializers.CharField(source="course_title_snapshot")
    cohortNameSnapshot = serializers.CharField(source="cohort_name_snapshot")
    issuedAt = serializers.DateTimeField(source="issued_at")

    class Meta:
        model = AcademyCertificate
        fields = ["studentNameSnapshot", "courseTitleSnapshot", "cohortNameSnapshot", "issuedAt"]


class RosterEntrySerializer(serializers.Serializer):
    userId = serializers.IntegerField()
    name = serializers.CharField()
    dayReached = serializers.IntegerField()
    lastActive = serializers.CharField()
    standing = serializers.CharField()
    shortlisted = serializers.BooleanField()


class StudentProfileSubmissionSerializer(serializers.Serializer):
    day = serializers.IntegerField()
    task = serializers.CharField()
    url = serializers.CharField()
    submittedAgo = serializers.CharField()
    rated = serializers.BooleanField()


class StudentProfileJudgmentSerializer(serializers.Serializer):
    task = serializers.CharField(allow_null=True)
    brief = serializers.IntegerField()
    craft = serializers.IntegerField()
    originality = serializers.IntegerField()
    average = serializers.FloatField()
    feedback = serializers.CharField()


class TopRatedEntrySerializer(serializers.Serializer):
    userId = serializers.IntegerField()
    name = serializers.CharField()
    avgScore = serializers.FloatField()


class AcademyLiveSessionSerializer(serializers.ModelSerializer):
    class Meta:
        model = AcademyLiveSession
        fields = ["id", "cohort", "title", "type", "day", "time", "host", "link"]


class TeamMemberSerializer(serializers.Serializer):
    id = serializers.IntegerField()
    name = serializers.CharField()
    email = serializers.CharField(allow_null=True)
    whatsapp = serializers.CharField(allow_null=True, allow_blank=True)


class AcademyTeamSerializer(serializers.Serializer):
    id = serializers.IntegerField()
    week = serializers.IntegerField()
    title = serializers.CharField()
    members = TeamMemberSerializer(many=True)


class RosterRequestSerializer(serializers.Serializer):
    """Ported from backend/src/utils/roster-request.ts's shapeRosterRequest
    — shared shape regardless of whether the request originates from the
    cohort-scoped create/list actions or the admin-wide listing (Stage 11)."""

    id = serializers.IntegerField()
    status = serializers.CharField()
    count = serializers.IntegerField(allow_null=True)
    note = serializers.CharField(allow_null=True, allow_blank=True)
    createdAt = serializers.DateTimeField()
    cohort = serializers.DictField(allow_null=True)
    facilitator = serializers.DictField(allow_null=True)
