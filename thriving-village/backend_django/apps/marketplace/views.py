import json

from django.utils import timezone
from django.views import View
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import NotFound, ValidationError
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.accounts.models import Role
from apps.accounts.permissions import IsAdminRole
from apps.activity.utils import log_activity
from apps.core.cache import invalidate_scope
from apps.core.exceptions import Conflict
from apps.core.mixins import CachedListMixin, EnvelopeMixin, PkForWriteMixin, UnwrapDataMixin
from apps.core.sse import sse_response, sse_stream
from apps.integrations.circuit_breaker import BulkheadRejectedError, CircuitOpenError
from apps.integrations.cloudinary_client import upload_file
from apps.integrations.pubsub import publish, subscribe

from .filters import CourseFilter, JobFilter, ProductFilter
from .models import Brand, Contest, ContestEntry, Course, Enrollment, Job, JobApplication, LessonProgress, Product, SavedJob, Testimonial
from .serializers import (
    ApplySerializer,
    BrandSerializer,
    ContestEntrySerializer,
    ContestEntryStatusSerializer,
    ContestSerializer,
    ContestWriteSerializer,
    CourseDetailSerializer,
    CourseListSerializer,
    CourseWriteSerializer,
    EnrollSerializer,
    EnterSerializer,
    JobApplicationSerializer,
    JobApplicationStatusSerializer,
    JobSerializer,
    JobWriteSerializer,
    MarkProgressSerializer,
    ProductSerializer,
    SavedJobSerializer,
    TestimonialSerializer,
    time_ago,
)

ADMIN_WRITE_ACTIONS = ("create", "update", "partial_update", "destroy")


def _parse_apply_like_body(request):
    """Mirrors src/lib/actions/applications.ts's `postApplyLike`: multipart
    with a JSON `data` field + a file field when a file is attached, plain
    JSON body otherwise."""
    content_type = request.content_type or ""
    if content_type.startswith("multipart/form-data"):
        raw = request.data.get("data", "{}")
        fields = json.loads(raw) if isinstance(raw, str) else raw
        return fields, request.FILES
    return request.data, {}


class JobViewSet(CachedListMixin, EnvelopeMixin, UnwrapDataMixin, PkForWriteMixin, viewsets.ModelViewSet):
    """Mirrors backend/src/api/job/controllers/job.ts's find/findOne: drafts
    are hidden from everyone except Admin (404 on direct findOne access,
    filtered out of find's list). create/update/delete are admin-only, per
    ADMIN_ACTIONS in backend/src/index.ts — talent/employer never get them."""

    lookup_field = "slug"
    permission_classes = [AllowAny]
    filterset_class = JobFilter
    search_fields = ["title", "org", "summary"]
    ordering_fields = ["created_at"]
    cache_scope = "jobs"
    cache_ttl = 30

    def get_serializer_class(self):
        return JobWriteSerializer if self.action in ADMIN_WRITE_ACTIONS else JobSerializer

    def get_queryset(self):
        qs = Job.objects.all()
        user = self.request.user
        if not (user.is_authenticated and user.role == Role.ADMIN):
            qs = qs.exclude(status="draft")
        return qs

    def get_permissions(self):
        if self.action == "apply":
            return [IsAuthenticated()]
        if self.action == "applicants" or self.action in ADMIN_WRITE_ACTIONS:
            return [IsAdminRole()]
        return super().get_permissions()

    def perform_create(self, serializer):
        job = serializer.save()
        invalidate_scope("jobs")

        # Public job board listens on /jobs/stream for this — only broadcast
        # jobs visible to the public (drafts are filtered out of find/findOne
        # the same way for everyone else).
        if job.status != "draft":
            publish(
                "tv:job:created",
                {
                    "id": job.slug,
                    "title": job.title,
                    "org": job.org,
                    "orgKind": job.org_kind,
                    "field": job.field,
                    "location": job.location,
                    "locationType": job.location_type,
                    "type": job.type,
                    "level": job.level,
                    "pay": job.pay,
                    "postedAgo": time_ago(job.created_at),
                },
            )

    def perform_update(self, serializer):
        serializer.save()
        invalidate_scope("jobs")

    def perform_destroy(self, instance):
        instance.delete()
        invalidate_scope("jobs")

    def retrieve(self, request, *args, **kwargs):
        response = super().retrieve(request, *args, **kwargs)
        user = request.user
        if response.data.get("data", {}).get("status") == "draft" and not (
            user.is_authenticated and user.role == Role.ADMIN
        ):
            raise NotFound()
        return response

    @action(detail=True, methods=["post"], parser_classes=[MultiPartParser, FormParser, JSONParser])
    def apply(self, request, slug=None):
        job = self.get_object()
        if job.status == "closed":
            raise ValidationError("This job is no longer accepting applications.")
        if JobApplication.objects.filter(job=job, user=request.user).exists():
            raise Conflict("You have already applied to this job.")

        fields, files = _parse_apply_like_body(request)
        serializer = ApplySerializer(data=fields)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        cv_data = {}
        cv_file = files.get("cv")
        if cv_file:
            try:
                uploaded = upload_file(cv_file, folder="job-applications")
            except (CircuitOpenError, BulkheadRejectedError):
                return Response({"error": {"message": "Upload service temporarily unavailable.", "status": 503}}, status=503)
            cv_data = {"cv_url": uploaded["url"], "cv_name": uploaded["name"], "cv_size": uploaded["size"], "cv_public_id": uploaded["public_id"]}

        application = JobApplication.objects.create(
            job=job,
            user=request.user,
            name=data["name"],
            whatsapp=data["whatsapp"],
            message=data.get("message", ""),
            portfolio_url=data.get("portfolioUrl", ""),
            video_url=data["videoUrl"],
            status="Applied",
            **cv_data,
        )
        log_activity(who=data["name"], what=f"applied to {job.title}", kind="application")
        return Response({"data": JobApplicationSerializer(application).data}, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=["get"])
    def applicants(self, request, slug=None):
        job = self.get_object()
        rows = JobApplication.objects.filter(job=job).order_by("-created_at")[:200]
        return Response({"data": JobApplicationSerializer(rows, many=True).data})


class ContestViewSet(CachedListMixin, EnvelopeMixin, UnwrapDataMixin, PkForWriteMixin, viewsets.ModelViewSet):
    queryset = Contest.objects.prefetch_related("prizes").all()
    lookup_field = "slug"
    permission_classes = [AllowAny]
    filterset_fields = ["field", "status"]
    search_fields = ["title", "brief"]
    ordering_fields = ["deadline", "created_at"]
    cache_scope = "contests"
    cache_ttl = 30

    def get_serializer_class(self):
        return ContestWriteSerializer if self.action in ADMIN_WRITE_ACTIONS else ContestSerializer

    def get_permissions(self):
        if self.action == "entries":
            return [IsAuthenticated()]
        if self.action == "entries_find" or self.action in ADMIN_WRITE_ACTIONS:
            return [IsAdminRole()]
        return super().get_permissions()

    def perform_create(self, serializer):
        serializer.save()
        invalidate_scope("contests")

    def perform_update(self, serializer):
        serializer.save()
        invalidate_scope("contests")

    def perform_destroy(self, instance):
        instance.delete()
        invalidate_scope("contests")

    @action(detail=True, methods=["post"], url_path="entries", parser_classes=[MultiPartParser, FormParser, JSONParser])
    def entries(self, request, slug=None):
        contest = self.get_object()
        if contest.status != "live" or contest.deadline < timezone.now():
            raise ValidationError("This contest is no longer accepting entries.")
        if ContestEntry.objects.filter(contest=contest, user=request.user).exists():
            raise Conflict("You have already entered this contest.")

        fields, files = _parse_apply_like_body(request)
        serializer = EnterSerializer(data=fields)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        work_data = {}
        work_file = files.get("work")
        if work_file:
            try:
                uploaded = upload_file(work_file, folder="contest-entries")
            except (CircuitOpenError, BulkheadRejectedError):
                return Response({"error": {"message": "Upload service temporarily unavailable.", "status": 503}}, status=503)
            work_data = {"work_url": uploaded["url"], "work_name": uploaded["name"], "work_size": uploaded["size"], "work_public_id": uploaded["public_id"]}

        entry = ContestEntry.objects.create(
            contest=contest,
            user=request.user,
            name=data["name"],
            whatsapp=data["whatsapp"],
            description=data["description"],
            status="Submitted",
            **work_data,
        )
        Contest.objects.filter(pk=contest.pk).update(entries=contest.entries + 1)
        invalidate_scope("contests")  # entries count changed — bypassed the queryset cache
        log_activity(who=data["name"], what=f"entered {contest.title}", kind="entry")
        return Response({"data": ContestEntrySerializer(entry).data}, status=status.HTTP_201_CREATED)

    @entries.mapping.get
    def entries_find(self, request, slug=None):
        """GET .../contests/:slug/entries — admin-only, every entry
        regardless of rank (unlike `leaderboard`, which only shows entries
        that already have one). The full entrant pool an admin picks
        winners from."""
        contest = self.get_object()
        rows = ContestEntry.objects.filter(contest=contest).order_by("-created_at")
        return Response({"data": ContestEntrySerializer(rows, many=True).data})

    @action(detail=True, methods=["get"], permission_classes=[AllowAny])
    def leaderboard(self, request, slug=None):
        contest = self.get_object()
        prizes_by_place = {p.place: p for p in contest.prizes.all()}
        rows = ContestEntry.objects.filter(contest=contest, rank__isnull=False).order_by("rank")
        board = [
            {
                "name": e.name,
                "rank": e.rank,
                "note": e.description,
                "status": e.status,
                "prize": ({"label": prizes_by_place[e.rank].label, "amount": prizes_by_place[e.rank].amount} if e.rank in prizes_by_place else None),
            }
            for e in rows
        ]
        return Response({"data": board})


class CourseViewSet(CachedListMixin, EnvelopeMixin, UnwrapDataMixin, PkForWriteMixin, viewsets.ModelViewSet):
    """List/detail use different serializers, matching Strapi's controller:
    list only populates lesson `id`s (cheap lessonCount), detail populates
    the full curriculum."""

    queryset = Course.objects.prefetch_related("modules__lessons").all()
    lookup_field = "slug"
    permission_classes = [AllowAny]
    filterset_class = CourseFilter
    search_fields = ["title", "blurb", "instructor"]
    cache_scope = "courses"
    cache_ttl = 30

    def get_serializer_class(self):
        if self.action in ADMIN_WRITE_ACTIONS:
            return CourseWriteSerializer
        return CourseDetailSerializer if self.action == "retrieve" else CourseListSerializer

    def get_permissions(self):
        if self.action == "enroll":
            return [IsAuthenticated()]
        if self.action in ADMIN_WRITE_ACTIONS:
            return [IsAdminRole()]
        return super().get_permissions()

    def perform_create(self, serializer):
        serializer.save()
        invalidate_scope("courses")

    def perform_update(self, serializer):
        serializer.save()
        invalidate_scope("courses")

    def perform_destroy(self, instance):
        instance.delete()
        invalidate_scope("courses")

    @action(detail=True, methods=["post"])
    def enroll(self, request, slug=None):
        course = self.get_object()
        if Enrollment.objects.filter(course=course, user=request.user).exists():
            raise Conflict("You are already enrolled in this course.")

        serializer = EnrollSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        enrollment = Enrollment.objects.create(
            course=course, user=request.user, name=data["name"], whatsapp=data["whatsapp"], message=data.get("message", "")
        )
        log_activity(who=data["name"], what=f"enrolled in {course.title}", kind="enrollment")
        return Response({"data": {"id": enrollment.id}}, status=status.HTTP_201_CREATED)


class ProductViewSet(CachedListMixin, EnvelopeMixin, viewsets.ReadOnlyModelViewSet):
    queryset = Product.objects.all()
    serializer_class = ProductSerializer
    lookup_field = "slug"
    permission_classes = [AllowAny]
    filterset_class = ProductFilter
    search_fields = ["name", "blurb"]
    ordering_fields = ["price", "created_at"]
    cache_scope = "products"
    cache_ttl = 60


class BrandViewSet(CachedListMixin, EnvelopeMixin, viewsets.ReadOnlyModelViewSet):
    queryset = Brand.objects.all()
    serializer_class = BrandSerializer
    permission_classes = [AllowAny]
    filterset_fields = ["kind", "featured"]
    ordering_fields = ["name"]
    cache_scope = "brands"
    cache_ttl = 120


class TestimonialViewSet(CachedListMixin, EnvelopeMixin, viewsets.ReadOnlyModelViewSet):
    queryset = Testimonial.objects.all()
    serializer_class = TestimonialSerializer
    permission_classes = [AllowAny]
    cache_scope = "testimonials"
    cache_ttl = 120


class SavedJobsView(APIView):
    """GET /api/saved-jobs (mine), POST /api/saved-jobs {jobSlug} — mirrors
    backend/src/api/saved-job/controllers/saved-job.ts's find/save."""

    permission_classes = [IsAuthenticated]

    def get(self, request):
        rows = SavedJob.objects.filter(user=request.user).select_related("job")[:100]
        return Response({"data": SavedJobSerializer(rows, many=True).data})

    def post(self, request):
        job_slug = request.data.get("jobSlug")
        if not job_slug:
            raise ValidationError("jobSlug is required.")
        job = Job.objects.filter(slug=job_slug).first()
        if not job:
            raise NotFound("Job not found.")
        saved, _ = SavedJob.objects.get_or_create(job=job, user=request.user)
        return Response({"data": SavedJobSerializer(saved).data})


class UnsaveJobView(APIView):
    """DELETE /api/saved-jobs/:jobSlug"""

    permission_classes = [IsAuthenticated]

    def delete(self, request, job_slug):
        job = Job.objects.filter(slug=job_slug).first()
        if not job:
            raise NotFound("Job not found.")
        deleted, _ = SavedJob.objects.filter(job=job, user=request.user).delete()
        if not deleted:
            raise NotFound("Saved job not found.")
        return Response({"data": {"jobSlug": job_slug}})


class LessonProgressView(APIView):
    """GET /api/lesson-progresses (mine, optional ?courseId=), POST /api/progress
    — mirrors lesson-progress.ts's find/mark."""

    permission_classes = [IsAuthenticated]

    def get(self, request):
        qs = LessonProgress.objects.all() if request.user.role == Role.ADMIN else LessonProgress.objects.filter(user=request.user)
        course_id = request.query_params.get("courseId")
        if course_id:
            qs = qs.filter(course_id=course_id)
        return Response({"data": [{"lessonKey": p.lesson_key} for p in qs[:100]]})


class MarkProgressView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        serializer = MarkProgressSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        course_id = serializer.validated_data["courseId"]
        lesson_key = serializer.validated_data["lessonKey"]

        course = Course.objects.prefetch_related("modules__lessons").filter(pk=course_id).first()
        if not course:
            raise NotFound("Course not found.")

        valid_keys = {lesson.key for module in course.modules.all() for lesson in module.lessons.all()}
        if lesson_key not in valid_keys:
            raise ValidationError("Unknown lessonKey for this course.")

        progress, _ = LessonProgress.objects.get_or_create(
            user=request.user, course=course, lesson_key=lesson_key, defaults={"completed_at": timezone.now()}
        )
        return Response({"data": {"id": progress.id}})


class MyApplicationsView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        rows = JobApplication.objects.filter(user=request.user).select_related("job").order_by("-created_at")
        return Response({"data": [{"jobId": r.job.slug, "status": r.status, "appliedAgo": time_ago(r.created_at)} for r in rows]})


class MyEntriesView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        rows = ContestEntry.objects.filter(user=request.user).select_related("contest").order_by("-created_at")
        return Response({"data": [{"contestId": r.contest.slug, "status": r.status, "submittedAgo": time_ago(r.created_at)} for r in rows]})


class MyCoursesView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        enrollments = Enrollment.objects.filter(user=request.user).select_related("course").prefetch_related("course__modules__lessons")
        progress_rows = LessonProgress.objects.filter(user=request.user).select_related("course")

        completed_by_course = {}
        for p in progress_rows:
            completed_by_course.setdefault(p.course_id, set()).add(p.lesson_key)

        data = []
        for e in enrollments:
            total_lessons = sum(len(m.lessons.all()) for m in e.course.modules.all())
            completed = len(completed_by_course.get(e.course_id, set()))
            progress_pct = round((completed / total_lessons) * 100) if total_lessons > 0 else 0
            data.append({"courseId": e.course.slug, "progress": progress_pct})
        return Response({"data": data})


# --- Stage 5: admin write endpoints. job-application/contest-entry only
# expose `update` (status changes) via the core route — Strapi's permission
# matrix grants no create/delete on these (rows only ever come from the
# apply/enter custom actions), so this is intentionally PUT-only.

class JobApplicationStatusView(APIView):
    """PUT /api/job-applications/:id — mirrors updateApplicationStatusAction
    in src/lib/actions/admin.ts (admin-only, status field only)."""

    permission_classes = [IsAdminRole]

    def put(self, request, pk):
        application = JobApplication.objects.filter(pk=pk).first()
        if not application:
            raise NotFound("Application not found.")
        serializer = JobApplicationStatusSerializer(application, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response({"data": JobApplicationSerializer(application).data})


class ContestEntryStatusView(APIView):
    """PUT /api/contest-entries/:id — admin-only status/rank changes. Also
    the winner-selection action: set status="Won" (+ rank) on the winning
    entries."""

    permission_classes = [IsAdminRole]

    def put(self, request, pk):
        entry = ContestEntry.objects.filter(pk=pk).select_related("contest").first()
        if not entry:
            raise NotFound("Entry not found.")
        serializer = ContestEntryStatusSerializer(entry, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        if serializer.validated_data.get("status") == "Won":
            log_activity(who="An admin", what=f"selected a winner for {entry.contest.title}", kind="contest-result")
        return Response({"data": ContestEntrySerializer(entry).data})


class JobStreamView(View):
    """GET /api/job-stream — public SSE stream of newly published jobs,
    port of job.ts's `stream` action. Deliberately not nested under
    /jobs/:something (collides with the core router's GET /jobs/:id) —
    same reasoning the original route file documents. Unauthenticated on
    purpose: the payload only ever contains fields already public via
    GET /jobs. The frontend's EventSource hits this exact path
    (src/components/cards/LiveJobList.tsx via src/app/api/jobs/stream/
    route.ts), so the path can't change even though Academy's SSE
    equivalent doesn't exist yet — this one has a live contract."""

    def get(self, request):
        return sse_response(sse_stream(subscribe("tv:job:created"), "job.created"))
