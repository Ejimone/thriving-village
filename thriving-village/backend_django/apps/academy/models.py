"""Stage 6/7 Academy models, ported field-for-field from
backend/src/api/{academy-category,academy-course,academy-cohort,
academy-material,academy-enrollment}/content-types/*/schema.json.

The Academy frontend was never actually wired to the Strapi backend (it ran
entirely off mocked localStorage state per ACADEMY_BACKEND_SPEC.md), so
unlike the marketplace stages there is no live API contract to preserve —
URL/query shapes here are designed DRF-idiomatic from scratch; only the
*business logic* (progression rules, facilitator scoping, anonymity) is
ported faithfully, since that's the part actually validated by the spec.
"""

from django.conf import settings
from django.db import models


class AcademyCategory(models.Model):
    name = models.CharField(max_length=255, unique=True)
    slug = models.SlugField(max_length=255, unique=True)
    blurb = models.TextField()

    class Meta:
        ordering = ["name"]
        verbose_name_plural = "academy categories"

    def __str__(self):
        return self.name


class AcademyCourse(models.Model):
    title = models.CharField(max_length=255)
    slug = models.SlugField(max_length=255, unique=True)
    category = models.ForeignKey(AcademyCategory, related_name="courses", on_delete=models.PROTECT)
    months = models.PositiveIntegerField()
    certificate = models.BooleanField(default=False)
    weeks_total = models.PositiveIntegerField()
    days_total = models.PositiveIntegerField()

    class Meta:
        ordering = ["title"]

    def __str__(self):
        return self.title


def _default_check_weeks() -> list:
    return [4, 8]


class AcademyCohort(models.Model):
    STATUS_CHOICES = [("Enrolling", "Enrolling"), ("Running", "Running"), ("Completed", "Completed")]

    name = models.CharField(max_length=255)
    course = models.ForeignKey(AcademyCourse, related_name="cohorts", on_delete=models.CASCADE)
    facilitator = models.ForeignKey(settings.AUTH_USER_MODEL, related_name="facilitated_cohorts", on_delete=models.PROTECT)
    weeks_total = models.PositiveIntegerField()
    days_total = models.PositiveIntegerField()
    start_date = models.DateField()
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default="Enrolling")
    released_week = models.PositiveIntegerField(default=0)
    min_completion = models.PositiveIntegerField(default=60)
    check_weeks = models.JSONField(default=_default_check_weeks)  # weeks the facilitator gate-checks pace at

    class Meta:
        ordering = ["-start_date"]

    def __str__(self):
        return self.name


class AcademyMaterial(models.Model):
    """Admin/facilitator-authored lesson content for one (course, day).
    `mux_*` fields are never serialized to API responses directly (see
    AcademyMaterialSerializer in Stage 10) — same "private" intent as
    Strapi's `private: true` on these fields."""

    course = models.ForeignKey(AcademyCourse, related_name="materials", on_delete=models.CASCADE)
    day = models.PositiveIntegerField()
    text = models.TextField(blank=True)
    external_video_url = models.URLField(blank=True)
    mux_upload_id = models.CharField(max_length=255, blank=True)
    mux_asset_id = models.CharField(max_length=255, blank=True)
    mux_playback_id = models.CharField(max_length=255, blank=True)
    task = models.CharField(max_length=255, blank=True)
    task_detail = models.TextField(blank=True)
    docs = models.JSONField(default=list, blank=True)

    class Meta:
        ordering = ["day"]
        unique_together = [("course", "day")]


class AcademyEnrollment(models.Model):
    STATUS_CHOICES = [("In progress", "In progress"), ("Starting soon", "Starting soon"), ("Completed", "Completed")]

    user = models.ForeignKey(settings.AUTH_USER_MODEL, related_name="academy_enrollments", on_delete=models.CASCADE)
    cohort = models.ForeignKey(AcademyCohort, related_name="enrollments", on_delete=models.CASCADE)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default="Starting soon")
    current_day = models.PositiveIntegerField(default=1)
    submitted_days = models.JSONField(default=list)
    early_access_requested = models.BooleanField(default=False)
    early_weeks = models.JSONField(default=list)
    removed = models.BooleanField(default=False)
    shortlisted = models.BooleanField(default=False)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]
        unique_together = [("user", "cohort")]


def _generate_verification_code() -> str:
    import secrets

    return secrets.token_urlsafe(6)


class AcademyCertificate(models.Model):
    """Issued automatically by apps.academy.completion.maybe_complete_enrollment
    — never created directly via the API (ported 1:1 from
    backend/src/api/academy-certificate/content-types/academy-certificate/
    lifecycles.ts's beforeCreate hook, which generates `verification_code`
    the same way: a short random URL-safe token, not derived from any
    human-readable field). The public `/verify/:code` endpoint and admin
    listing are Stage 9 — this model exists now because Stage 7's completion
    logic depends on it.
    """

    enrollment = models.OneToOneField(AcademyEnrollment, related_name="certificate", on_delete=models.CASCADE)
    verification_code = models.CharField(max_length=32, unique=True, default=_generate_verification_code)
    issued_at = models.DateTimeField()
    student_name_snapshot = models.CharField(max_length=255)
    course_title_snapshot = models.CharField(max_length=255)
    cohort_name_snapshot = models.CharField(max_length=255)
    pdf_url = models.URLField(blank=True)

    class Meta:
        ordering = ["-issued_at"]


# --- Stage 8: submissions + judging + anonymity, ported field-for-field
# from backend/src/api/{academy-submission,academy-judgment}/content-types/
# */schema.json. Judge anonymity is a hard rule (ACADEMY_BACKEND_SPEC.md
# §7) — note AcademyJudgment.judge is never serialized in any judge-facing
# response (apps/academy/serializers.py enforces this at the API layer; the
# model field itself has to exist so judgments can still be attributed for
# admin/facilitator-facing views like student_profile).

class AcademySubmission(models.Model):
    """`course_title`/`anon_handle` are denormalized onto the row
    specifically so the judge queue never needs to populate `enrollment`
    (the relation chain that leads back to user/cohort)."""

    enrollment = models.ForeignKey(AcademyEnrollment, related_name="submissions", on_delete=models.CASCADE)
    day = models.PositiveIntegerField()
    week = models.PositiveIntegerField()
    task = models.CharField(max_length=255)
    course_title = models.CharField(max_length=255)
    url = models.URLField()
    note = models.TextField(blank=True)
    submitted_at = models.DateTimeField()
    rated = models.BooleanField(default=False)
    anon_handle = models.CharField(max_length=32, unique=True)

    class Meta:
        ordering = ["-day"]


class AcademyJudgment(models.Model):
    submission = models.ForeignKey(AcademySubmission, related_name="judgments", on_delete=models.CASCADE)
    judge = models.ForeignKey(settings.AUTH_USER_MODEL, related_name="academy_judgments", on_delete=models.CASCADE)
    brief = models.PositiveSmallIntegerField()
    craft = models.PositiveSmallIntegerField()
    originality = models.PositiveSmallIntegerField()
    average = models.DecimalField(max_digits=4, decimal_places=2)
    feedback = models.TextField()

    class Meta:
        ordering = ["-id"]
        unique_together = [("submission", "judge")]


# --- Stage 9: certificates were already added in Stage 6/7 above. The rest
# of the facilitator roster-tool models, ported from backend/src/api/
# {academy-team,academy-live-session,academy-roster-request}/content-types/
# */schema.json.

class AcademyTeam(models.Model):
    cohort = models.ForeignKey(AcademyCohort, related_name="teams", on_delete=models.CASCADE)
    week = models.PositiveIntegerField()
    title = models.CharField(max_length=255)
    members = models.ManyToManyField(settings.AUTH_USER_MODEL, related_name="academy_teams", blank=True)

    class Meta:
        ordering = ["-id"]


class AcademyLiveSession(models.Model):
    TYPE_CHOICES = [("Live call", "Live call"), ("Workshop", "Workshop")]

    cohort = models.ForeignKey(AcademyCohort, related_name="sessions", on_delete=models.CASCADE)
    title = models.CharField(max_length=255)
    type = models.CharField(max_length=20, choices=TYPE_CHOICES)
    day = models.CharField(max_length=50)
    time = models.CharField(max_length=50)
    host = models.CharField(max_length=255)
    link = models.URLField(blank=True)

    class Meta:
        ordering = ["id"]


class AcademyRosterRequest(models.Model):
    STATUS_CHOICES = [("Pending", "Pending"), ("Fulfilled", "Fulfilled"), ("Dismissed", "Dismissed")]

    facilitator = models.ForeignKey(settings.AUTH_USER_MODEL, related_name="roster_requests", on_delete=models.CASCADE)
    cohort = models.ForeignKey(AcademyCohort, related_name="roster_requests", on_delete=models.CASCADE)
    count = models.PositiveIntegerField(null=True, blank=True)
    note = models.TextField(blank=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default="Pending")

    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]
