from django.contrib import admin
from unfold.admin import ModelAdmin, TabularInline

from apps.core.admin import AutoSlugAdminMixin

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


class PrizeInline(TabularInline):
    model = Prize
    extra = 0


class LessonInline(TabularInline):
    model = Lesson
    extra = 0


class ModuleInline(TabularInline):
    model = Module
    extra = 0


@admin.register(Module)
class ModuleAdmin(ModelAdmin):
    list_display = ["title", "course", "order"]
    inlines = [LessonInline]


@admin.register(Job)
class JobAdmin(AutoSlugAdminMixin, ModelAdmin):
    list_display = ["title", "org", "field", "status", "created_at"]
    list_filter = ["field", "status", "level"]
    search_fields = ["title", "org"]
    prepopulated_fields = {"slug": ("title",)}
    slug_source_field = "title"


@admin.register(Contest)
class ContestAdmin(AutoSlugAdminMixin, ModelAdmin):
    list_display = ["title", "field", "status", "deadline", "entries"]
    list_filter = ["field", "status"]
    inlines = [PrizeInline]
    prepopulated_fields = {"slug": ("title",)}
    slug_source_field = "title"


@admin.register(Course)
class CourseAdmin(AutoSlugAdminMixin, ModelAdmin):
    list_display = ["title", "field", "kind", "delivery", "price"]
    list_filter = ["field", "kind", "delivery"]
    inlines = [ModuleInline]
    prepopulated_fields = {"slug": ("title",)}
    slug_source_field = "title"


@admin.register(Product)
class ProductAdmin(AutoSlugAdminMixin, ModelAdmin):
    list_display = ["name", "category", "type", "price"]
    list_filter = ["category", "type", "condition"]
    prepopulated_fields = {"slug": ("name",)}
    slug_source_field = "name"


@admin.register(Lesson)
class LessonAdmin(ModelAdmin):
    pass


@admin.register(Brand)
class BrandAdmin(ModelAdmin):
    pass


@admin.register(Testimonial)
class TestimonialAdmin(ModelAdmin):
    pass


@admin.register(JobApplication)
class JobApplicationAdmin(ModelAdmin):
    list_display = ["name", "job", "status", "created_at"]
    list_filter = ["status"]


@admin.register(ContestEntry)
class ContestEntryAdmin(ModelAdmin):
    list_display = ["name", "contest", "status", "rank", "created_at"]
    list_filter = ["status"]


@admin.register(Enrollment)
class EnrollmentAdmin(ModelAdmin):
    pass


@admin.register(SavedJob)
class SavedJobAdmin(ModelAdmin):
    pass


@admin.register(LessonProgress)
class LessonProgressAdmin(ModelAdmin):
    pass
