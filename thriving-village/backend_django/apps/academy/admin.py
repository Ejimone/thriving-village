from django.contrib import admin

from .models import (
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


@admin.register(AcademyCategory)
class AcademyCategoryAdmin(admin.ModelAdmin):
    list_display = ["name", "slug"]
    prepopulated_fields = {"slug": ("name",)}


@admin.register(AcademyCourse)
class AcademyCourseAdmin(admin.ModelAdmin):
    list_display = ["title", "category", "months", "certificate"]
    list_filter = ["category", "certificate"]
    prepopulated_fields = {"slug": ("title",)}


@admin.register(AcademyCohort)
class AcademyCohortAdmin(admin.ModelAdmin):
    list_display = ["name", "course", "facilitator", "status", "released_week", "start_date"]
    list_filter = ["status"]


@admin.register(AcademyMaterial)
class AcademyMaterialAdmin(admin.ModelAdmin):
    list_display = ["course", "day", "task"]
    list_filter = ["course"]


@admin.register(AcademyEnrollment)
class AcademyEnrollmentAdmin(admin.ModelAdmin):
    list_display = ["user", "cohort", "status", "current_day", "removed"]
    list_filter = ["status", "removed"]


admin.site.register(AcademyCertificate)
admin.site.register(AcademySubmission)
admin.site.register(AcademyJudgment)
admin.site.register(AcademyTeam)
admin.site.register(AcademyLiveSession)
admin.site.register(AcademyRosterRequest)
