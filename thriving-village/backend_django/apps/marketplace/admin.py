from django.contrib import admin

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


class PrizeInline(admin.TabularInline):
    model = Prize
    extra = 0


class LessonInline(admin.TabularInline):
    model = Lesson
    extra = 0


class ModuleInline(admin.TabularInline):
    model = Module
    extra = 0


@admin.register(Module)
class ModuleAdmin(admin.ModelAdmin):
    list_display = ["title", "course", "order"]
    inlines = [LessonInline]


@admin.register(Job)
class JobAdmin(admin.ModelAdmin):
    list_display = ["title", "org", "field", "status", "created_at"]
    list_filter = ["field", "status", "level"]
    search_fields = ["title", "org"]
    prepopulated_fields = {"slug": ("title",)}


@admin.register(Contest)
class ContestAdmin(admin.ModelAdmin):
    list_display = ["title", "field", "status", "deadline", "entries"]
    list_filter = ["field", "status"]
    inlines = [PrizeInline]
    prepopulated_fields = {"slug": ("title",)}


@admin.register(Course)
class CourseAdmin(admin.ModelAdmin):
    list_display = ["title", "field", "kind", "delivery", "price"]
    list_filter = ["field", "kind", "delivery"]
    inlines = [ModuleInline]
    prepopulated_fields = {"slug": ("title",)}


@admin.register(Product)
class ProductAdmin(admin.ModelAdmin):
    list_display = ["name", "category", "type", "price"]
    list_filter = ["category", "type", "condition"]
    prepopulated_fields = {"slug": ("name",)}


admin.site.register(Lesson)
admin.site.register(Brand)
admin.site.register(Testimonial)


@admin.register(JobApplication)
class JobApplicationAdmin(admin.ModelAdmin):
    list_display = ["name", "job", "status", "created_at"]
    list_filter = ["status"]


@admin.register(ContestEntry)
class ContestEntryAdmin(admin.ModelAdmin):
    list_display = ["name", "contest", "status", "rank", "created_at"]
    list_filter = ["status"]


admin.site.register(Enrollment)
admin.site.register(SavedJob)
admin.site.register(LessonProgress)
