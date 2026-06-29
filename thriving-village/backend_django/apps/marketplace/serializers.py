from datetime import datetime, timezone

from rest_framework import serializers

from apps.core.mixins import DocumentIdMixin
from apps.core.slugs import slugify, unique_slug

from .models import (
    Brand,
    Contest,
    ContestEntry,
    Course,
    Enrollment,
    Job,
    JobApplication,
    Lesson,
    LessonProgress,
    Module,
    Prize,
    Product,
    SavedJob,
    Testimonial,
)


def time_ago(value) -> str:
    """Line-for-line port of the timeAgo() bucketing in
    backend/src/api/job/controllers/job.ts (and me.ts) — used for `postedAgo`
    and the /api/me/* "Xd ago" strings added in Stage 3."""
    ms = (datetime.now(timezone.utc) - value).total_seconds() * 1000
    days = int(ms // 86400000)
    if days <= 0:
        return "today"
    if days == 1:
        return "1 day ago"
    if days < 7:
        return f"{days} days ago"
    weeks = days // 7
    if weeks < 5:
        return "1 week ago" if weeks == 1 else f"{weeks} weeks ago"
    months = days // 30
    return "1 month ago" if months <= 1 else f"{months} months ago"


class JobSerializer(DocumentIdMixin, serializers.ModelSerializer):
    orgKind = serializers.CharField(source="org_kind")
    locationType = serializers.CharField(source="location_type")
    postedAgo = serializers.SerializerMethodField()

    class Meta:
        model = Job
        fields = [
            "id", "title", "slug", "org", "orgKind", "field", "location", "locationType",
            "type", "level", "pay", "summary", "responsibilities", "requirements", "status",
            "postedAgo", "created_at", "updated_at",
        ]

    def get_postedAgo(self, obj):
        return time_ago(obj.created_at)


class PrizeSerializer(serializers.ModelSerializer):
    class Meta:
        model = Prize
        fields = ["place", "label", "amount"]


class ContestSerializer(DocumentIdMixin, serializers.ModelSerializer):
    prizes = PrizeSerializer(many=True, read_only=True)
    daysLeft = serializers.SerializerMethodField()
    prizePool = serializers.SerializerMethodField()
    topPrize = serializers.SerializerMethodField()
    winnerCount = serializers.SerializerMethodField()

    class Meta:
        model = Contest
        fields = [
            "id", "title", "slug", "field", "brief", "rules", "deadline", "status",
            "entries", "prizes", "seed", "daysLeft", "prizePool", "topPrize", "winnerCount",
        ]

    def get_daysLeft(self, obj):
        import math

        return math.ceil((obj.deadline - datetime.now(timezone.utc)).total_seconds() / 86400)

    def get_prizePool(self, obj):
        return sum(float(p.amount) for p in obj.prizes.all())

    def get_topPrize(self, obj):
        amounts = [float(p.amount) for p in obj.prizes.all()]
        return max(amounts) if amounts else 0

    def get_winnerCount(self, obj):
        return obj.prizes.count()


class LessonSerializer(serializers.ModelSerializer):
    class Meta:
        model = Lesson
        fields = ["key", "title", "duration", "free"]


class LessonIdOnlySerializer(serializers.ModelSerializer):
    """Mirrors the Strapi `find` list view's `fields: ['id']` populate trick
    — lessonCount needs only a count, not the full curriculum payload."""

    class Meta:
        model = Lesson
        fields = ["id"]


class ModuleSerializer(serializers.ModelSerializer):
    lessons = LessonSerializer(many=True, read_only=True)

    class Meta:
        model = Module
        fields = ["title", "lessons"]


class ModuleLessonCountSerializer(serializers.ModelSerializer):
    lessons = LessonIdOnlySerializer(many=True, read_only=True)

    class Meta:
        model = Module
        fields = ["lessons"]


class CourseListSerializer(DocumentIdMixin, serializers.ModelSerializer):
    """List view: lessonCount only, no curriculum body — matches Strapi's
    `find` action stripping `modules` back out after computing the count."""

    instructorRole = serializers.CharField(source="instructor_role")
    lessonCount = serializers.SerializerMethodField()

    class Meta:
        model = Course
        fields = [
            "id", "title", "slug", "field", "level", "kind", "delivery", "location",
            "instructor", "instructorRole", "price", "weeks", "blurb", "outcomes",
            "seed", "lessonCount",
        ]

    def get_lessonCount(self, obj):
        return sum(m.lessons.count() for m in obj.modules.all())


class CourseDetailSerializer(DocumentIdMixin, serializers.ModelSerializer):
    instructorRole = serializers.CharField(source="instructor_role")
    modules = ModuleSerializer(many=True, read_only=True)
    lessonCount = serializers.SerializerMethodField()

    class Meta:
        model = Course
        fields = [
            "id", "title", "slug", "field", "level", "kind", "delivery", "location",
            "instructor", "instructorRole", "price", "weeks", "blurb", "outcomes",
            "modules", "seed", "lessonCount",
        ]

    def get_lessonCount(self, obj):
        return sum(len(m["lessons"]) for m in ModuleSerializer(obj.modules.all(), many=True).data)


class ProductSerializer(DocumentIdMixin, serializers.ModelSerializer):
    shopifyUrl = serializers.URLField(source="shopify_url")

    class Meta:
        model = Product
        fields = [
            "id", "name", "slug", "category", "type", "price", "blurb", "details",
            "sizes", "maker", "condition", "brand", "shopifyUrl", "seed",
        ]


class BrandSerializer(DocumentIdMixin, serializers.ModelSerializer):
    class Meta:
        model = Brand
        fields = ["id", "name", "kind", "industry", "tagline", "url", "featured", "seed"]


class TestimonialSerializer(DocumentIdMixin, serializers.ModelSerializer):
    class Meta:
        model = Testimonial
        fields = ["id", "quote", "name", "role"]


# --- Stage 3: write-side serializers, ported from the apply/enter/enroll
# request bodies in backend/src/api/{job,contest,course}/controllers/*.ts.

class ApplySerializer(serializers.Serializer):
    name = serializers.CharField()
    whatsapp = serializers.CharField()
    message = serializers.CharField(required=False, allow_blank=True, default="")
    portfolioUrl = serializers.URLField(required=False, allow_blank=True, default="")
    videoUrl = serializers.URLField()


class JobApplicationSerializer(DocumentIdMixin, serializers.ModelSerializer):
    """Backs `applicants` (admin) — mirrors job.ts's `applicants` action shape."""

    appliedAgo = serializers.SerializerMethodField()
    portfolioUrl = serializers.URLField(source="portfolio_url")
    videoUrl = serializers.URLField(source="video_url")
    cv = serializers.SerializerMethodField()

    class Meta:
        model = JobApplication
        fields = [
            "name", "whatsapp", "message", "portfolioUrl", "videoUrl",
            "status", "appliedAgo", "cv",
        ]

    def get_appliedAgo(self, obj):
        return time_ago(obj.created_at)

    def get_cv(self, obj):
        if not obj.cv_url:
            return None
        return {"url": obj.cv_url, "name": obj.cv_name, "size": obj.cv_size}


class EnterSerializer(serializers.Serializer):
    name = serializers.CharField()
    whatsapp = serializers.CharField()
    description = serializers.CharField()


class ContestEntrySerializer(DocumentIdMixin, serializers.ModelSerializer):
    class Meta:
        model = ContestEntry
        fields = ["name", "whatsapp", "description", "status", "rank", "created_at"]


class EnrollSerializer(serializers.Serializer):
    name = serializers.CharField()
    whatsapp = serializers.CharField()
    message = serializers.CharField(required=False, allow_blank=True, default="")


class SavedJobSerializer(serializers.ModelSerializer):
    """Mirrors the shape `getSavedJobSlugs` reads: `row.job.slug`."""

    job = serializers.SerializerMethodField()

    class Meta:
        model = SavedJob
        fields = ["job"]

    def get_job(self, obj):
        return {"slug": obj.job.slug}


class LessonProgressSerializer(serializers.ModelSerializer):
    lessonKey = serializers.CharField(source="lesson_key")

    class Meta:
        model = LessonProgress
        fields = ["lessonKey", "completed_at"]


class MarkProgressSerializer(serializers.Serializer):
    courseId = serializers.IntegerField()
    lessonKey = serializers.CharField()


# --- Stage 5: admin write serializers, ported from the field lists
# src/lib/actions/admin.ts's saveJobAction/saveContestAction/saveCourseAction
# build, and the create/update overrides in
# backend/src/api/{job,contest,course}/controllers/*.ts (auto-slug-on-create,
# and full-replace semantics for Strapi's repeatable components).

class JobWriteSerializer(DocumentIdMixin, serializers.ModelSerializer):
    orgKind = serializers.CharField(source="org_kind")
    locationType = serializers.CharField(source="location_type")
    postedAgo = serializers.SerializerMethodField()

    class Meta:
        model = Job
        fields = [
            "id", "title", "slug", "org", "orgKind", "field", "location", "locationType",
            "type", "level", "pay", "summary", "responsibilities", "requirements", "status",
            "postedAgo",
        ]
        extra_kwargs = {"slug": {"required": False}}

    def get_postedAgo(self, obj):
        return time_ago(obj.created_at)

    def create(self, validated_data):
        if not validated_data.get("slug"):
            validated_data["slug"] = unique_slug(Job, slugify(validated_data["title"]))
        return super().create(validated_data)


class PrizeWriteSerializer(serializers.Serializer):
    place = serializers.IntegerField()
    label = serializers.CharField()
    amount = serializers.DecimalField(max_digits=12, decimal_places=2)


class ContestWriteSerializer(DocumentIdMixin, serializers.ModelSerializer):
    prizes = PrizeWriteSerializer(many=True, required=False)

    class Meta:
        model = Contest
        fields = ["id", "title", "slug", "field", "brief", "rules", "deadline", "status", "entries", "prizes", "seed"]
        extra_kwargs = {"slug": {"required": False}}

    def create(self, validated_data):
        prizes = validated_data.pop("prizes", [])
        if not validated_data.get("slug"):
            validated_data["slug"] = unique_slug(Contest, slugify(validated_data["title"]))
        contest = super().create(validated_data)
        self._replace_prizes(contest, prizes)
        return contest

    def update(self, instance, validated_data):
        prizes = validated_data.pop("prizes", None)
        contest = super().update(instance, validated_data)
        if prizes is not None:
            self._replace_prizes(contest, prizes)
        return contest

    @staticmethod
    def _replace_prizes(contest, prizes):
        contest.prizes.all().delete()
        Prize.objects.bulk_create([Prize(contest=contest, **p) for p in prizes])


class LessonWriteSerializer(serializers.Serializer):
    key = serializers.CharField()
    title = serializers.CharField()
    duration = serializers.CharField()
    free = serializers.BooleanField(default=False)


class ModuleWriteSerializer(serializers.Serializer):
    title = serializers.CharField()
    lessons = LessonWriteSerializer(many=True, required=False)


class CourseWriteSerializer(DocumentIdMixin, serializers.ModelSerializer):
    instructorRole = serializers.CharField(source="instructor_role")
    modules = ModuleWriteSerializer(many=True, required=False)

    class Meta:
        model = Course
        fields = [
            "id", "title", "slug", "field", "level", "kind", "delivery", "location",
            "instructor", "instructorRole", "price", "weeks", "blurb", "outcomes",
            "modules", "seed",
        ]
        extra_kwargs = {"slug": {"required": False}}

    def create(self, validated_data):
        modules = validated_data.pop("modules", [])
        if not validated_data.get("slug"):
            validated_data["slug"] = unique_slug(Course, slugify(validated_data["title"]))
        course = super().create(validated_data)
        self._replace_modules(course, modules)
        return course

    def update(self, instance, validated_data):
        modules = validated_data.pop("modules", None)
        course = super().update(instance, validated_data)
        if modules is not None:
            self._replace_modules(course, modules)
        return course

    @staticmethod
    def _replace_modules(course, modules):
        course.modules.all().delete()
        for order, module_data in enumerate(modules, start=1):
            lessons = module_data.pop("lessons", [])
            module = Module.objects.create(course=course, title=module_data["title"], order=order)
            Lesson.objects.bulk_create(
                [Lesson(module=module, order=i, **lesson) for i, lesson in enumerate(lessons, start=1)]
            )


class JobApplicationStatusSerializer(serializers.ModelSerializer):
    class Meta:
        model = JobApplication
        fields = ["status"]


class ContestEntryStatusSerializer(serializers.ModelSerializer):
    class Meta:
        model = ContestEntry
        fields = ["status", "rank"]
