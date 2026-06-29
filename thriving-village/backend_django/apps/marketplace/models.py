"""Catalog models for Stage 2 (Job, Contest+Prize, Course+Module+Lesson,
Product, Brand, Testimonial), ported field-for-field from the Strapi schemas
at backend/src/api/{job,contest,course,product,brand,testimonial}/
content-types/*/schema.json. Stage 3 adds JobApplication/ContestEntry/
Enrollment/SavedJob/LessonProgress (the write-side models) to this file.
"""

from django.conf import settings
from django.db import models

FIELD_CHOICES = [
    ("Digital", "Digital"),
    ("Technical", "Technical"),
    ("Craft", "Craft"),
    ("Creative", "Creative"),
]
LEVEL_CHOICES = [("Entry", "Entry"), ("Mid", "Mid"), ("Senior", "Senior")]


class Job(models.Model):
    STATUS_CHOICES = [("draft", "draft"), ("published", "published"), ("closed", "closed")]
    LOCATION_TYPE_CHOICES = [("Remote", "Remote"), ("Onsite", "Onsite"), ("Hybrid", "Hybrid")]
    TYPE_CHOICES = [("Full-time", "Full-time"), ("Part-time", "Part-time"), ("Contract", "Contract")]

    title = models.CharField(max_length=255)
    slug = models.SlugField(max_length=255, unique=True)
    org = models.CharField(max_length=255)
    org_kind = models.CharField(max_length=255)
    field = models.CharField(max_length=20, choices=FIELD_CHOICES)
    location = models.CharField(max_length=255)
    location_type = models.CharField(max_length=20, choices=LOCATION_TYPE_CHOICES)
    type = models.CharField(max_length=20, choices=TYPE_CHOICES)
    level = models.CharField(max_length=20, choices=LEVEL_CHOICES)
    pay = models.CharField(max_length=255)
    summary = models.TextField()
    responsibilities = models.JSONField(default=list)
    requirements = models.JSONField(default=list)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default="published")

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return self.title


class Contest(models.Model):
    STATUS_CHOICES = [("live", "live"), ("past", "past")]

    title = models.CharField(max_length=255)
    slug = models.SlugField(max_length=255, unique=True)
    field = models.CharField(max_length=20, choices=FIELD_CHOICES)
    brief = models.TextField()
    rules = models.JSONField(default=list)
    deadline = models.DateTimeField()
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default="live")
    entries = models.PositiveIntegerField(default=0)
    seed = models.CharField(max_length=255, blank=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return self.title


class Prize(models.Model):
    """Promoted from Strapi's repeatable `contest.prize` component to a real
    related table (approved plan: components → ordered FK rows)."""

    contest = models.ForeignKey(Contest, related_name="prizes", on_delete=models.CASCADE)
    place = models.PositiveIntegerField()
    label = models.CharField(max_length=255)
    amount = models.DecimalField(max_digits=12, decimal_places=2)

    class Meta:
        ordering = ["place"]


class Course(models.Model):
    KIND_CHOICES = [("Course", "Course"), ("Certification", "Certification")]
    DELIVERY_CHOICES = [("Online", "Online"), ("Onsite", "Onsite"), ("Hybrid", "Hybrid")]

    title = models.CharField(max_length=255)
    slug = models.SlugField(max_length=255, unique=True)
    field = models.CharField(max_length=20, choices=FIELD_CHOICES)
    level = models.CharField(max_length=20, choices=LEVEL_CHOICES)
    kind = models.CharField(max_length=20, choices=KIND_CHOICES)
    delivery = models.CharField(max_length=20, choices=DELIVERY_CHOICES)
    location = models.CharField(max_length=255, blank=True)
    instructor = models.CharField(max_length=255)
    instructor_role = models.CharField(max_length=255)
    price = models.DecimalField(max_digits=12, decimal_places=2)
    weeks = models.PositiveIntegerField()
    blurb = models.TextField()
    outcomes = models.JSONField(default=list)
    seed = models.CharField(max_length=255, blank=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return self.title


class Module(models.Model):
    """Promoted from Strapi's repeatable `course.module` component."""

    course = models.ForeignKey(Course, related_name="modules", on_delete=models.CASCADE)
    title = models.CharField(max_length=255)
    order = models.PositiveIntegerField(default=0)

    class Meta:
        ordering = ["order"]


class Lesson(models.Model):
    """Promoted from Strapi's repeatable `course.lesson` component, nested
    inside `course.module`. `unique_together(module, key)` is a free
    correctness upgrade Strapi's component table never enforced."""

    module = models.ForeignKey(Module, related_name="lessons", on_delete=models.CASCADE)
    key = models.CharField(max_length=255)
    title = models.CharField(max_length=255)
    duration = models.CharField(max_length=50)
    free = models.BooleanField(default=False)
    order = models.PositiveIntegerField(default=0)

    class Meta:
        ordering = ["order"]
        unique_together = [("module", "key")]


class Product(models.Model):
    CATEGORY_CHOICES = [(c, c) for c in ["Apparel", "Accessories", "Electronics", "Tools", "Furniture", "Home"]]
    TYPE_CHOICES = [
        (t, t)
        for t in [
            "Tee", "Sweatshirt", "Hoodie", "Apron", "Cap", "Tote", "Sticker",
            "Laptop", "Phone", "Tablet", "Monitor", "Headphones", "Keyboard", "Charger",
            "Drill", "Toolkit", "Mug", "Notebook", "Desk", "Stool", "Shelf",
        ]
    ]
    CONDITION_CHOICES = [("New", "New"), ("Used", "Used"), ("Refurbished", "Refurbished")]

    name = models.CharField(max_length=255)
    slug = models.SlugField(max_length=255, unique=True)
    category = models.CharField(max_length=20, choices=CATEGORY_CHOICES)
    type = models.CharField(max_length=20, choices=TYPE_CHOICES)
    price = models.DecimalField(max_digits=12, decimal_places=2)
    blurb = models.TextField()
    details = models.JSONField(default=list)
    sizes = models.JSONField(default=list, blank=True)
    maker = models.CharField(max_length=255, blank=True)
    condition = models.CharField(max_length=20, choices=CONDITION_CHOICES, default="New")
    brand = models.CharField(max_length=255, blank=True)
    shopify_url = models.URLField()
    seed = models.CharField(max_length=255, blank=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return self.name


class Brand(models.Model):
    KIND_CHOICES = [("Sister business", "Sister business"), ("Partner", "Partner")]

    name = models.CharField(max_length=255)
    kind = models.CharField(max_length=20, choices=KIND_CHOICES)
    industry = models.CharField(max_length=255)
    tagline = models.CharField(max_length=255)
    url = models.URLField()
    featured = models.BooleanField(default=False)
    seed = models.CharField(max_length=255, blank=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return self.name


class Testimonial(models.Model):
    quote = models.TextField()
    name = models.CharField(max_length=255)
    role = models.CharField(max_length=255)

    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return self.name


# --- Stage 3: write-side models, ported field-for-field from
# backend/src/api/{job-application,contest-entry,enrollment,saved-job,
# lesson-progress}/content-types/*/schema.json. `unique_together` on the
# four one-row-per-user-per-target relations is a free correctness upgrade —
# Strapi left these app-enforced only (see the controllers' own
# findOne-before-create checks).

APPLICATION_STATUS_CHOICES = [
    (s, s) for s in ["Applied", "In review", "Interview", "Shortlisted", "Closed", "Archived"]
]


class JobApplication(models.Model):
    job = models.ForeignKey(Job, related_name="applications", on_delete=models.CASCADE)
    user = models.ForeignKey(settings.AUTH_USER_MODEL, related_name="job_applications", on_delete=models.CASCADE)
    name = models.CharField(max_length=255)
    whatsapp = models.CharField(max_length=32)
    message = models.TextField(blank=True)
    cv_url = models.URLField(blank=True)
    cv_name = models.CharField(max_length=255, blank=True)
    cv_size = models.PositiveIntegerField(null=True, blank=True)
    cv_public_id = models.CharField(max_length=255, blank=True)
    portfolio_url = models.URLField(blank=True)
    video_url = models.URLField()
    status = models.CharField(max_length=20, choices=APPLICATION_STATUS_CHOICES, default="Applied")

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]
        unique_together = [("job", "user")]


ENTRY_STATUS_CHOICES = [(s, s) for s in ["Submitted", "Shortlisted", "Won", "Not selected"]]


class ContestEntry(models.Model):
    contest = models.ForeignKey(Contest, related_name="entries_set", on_delete=models.CASCADE)
    user = models.ForeignKey(settings.AUTH_USER_MODEL, related_name="contest_entries", on_delete=models.CASCADE)
    name = models.CharField(max_length=255)
    whatsapp = models.CharField(max_length=32)
    description = models.TextField()
    work_url = models.URLField(blank=True)
    work_name = models.CharField(max_length=255, blank=True)
    work_size = models.PositiveIntegerField(null=True, blank=True)
    work_public_id = models.CharField(max_length=255, blank=True)
    status = models.CharField(max_length=20, choices=ENTRY_STATUS_CHOICES, default="Submitted")
    rank = models.PositiveIntegerField(null=True, blank=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]
        unique_together = [("contest", "user")]


class Enrollment(models.Model):
    course = models.ForeignKey(Course, related_name="enrollments", on_delete=models.CASCADE)
    user = models.ForeignKey(settings.AUTH_USER_MODEL, related_name="enrollments", on_delete=models.CASCADE)
    name = models.CharField(max_length=255)
    whatsapp = models.CharField(max_length=32)
    message = models.TextField(blank=True)

    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]
        unique_together = [("course", "user")]


class SavedJob(models.Model):
    job = models.ForeignKey(Job, related_name="saved_by", on_delete=models.CASCADE)
    user = models.ForeignKey(settings.AUTH_USER_MODEL, related_name="saved_jobs", on_delete=models.CASCADE)

    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]
        unique_together = [("job", "user")]


class LessonProgress(models.Model):
    user = models.ForeignKey(settings.AUTH_USER_MODEL, related_name="lesson_progress", on_delete=models.CASCADE)
    course = models.ForeignKey(Course, related_name="lesson_progress", on_delete=models.CASCADE)
    lesson_key = models.CharField(max_length=255)
    completed_at = models.DateTimeField()

    class Meta:
        ordering = ["-completed_at"]
        unique_together = [("user", "course", "lesson_key")]
