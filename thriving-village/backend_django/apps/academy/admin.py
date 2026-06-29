from django.contrib import admin
from unfold.admin import ModelAdmin

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
class AcademyCategoryAdmin(ModelAdmin):
    list_display = ["name", "slug"]
    prepopulated_fields = {"slug": ("name",)}


@admin.register(AcademyCourse)
class AcademyCourseAdmin(ModelAdmin):
    list_display = ["title", "category", "months", "certificate"]
    list_filter = ["category", "certificate"]
    prepopulated_fields = {"slug": ("title",)}


@admin.register(AcademyCohort)
class AcademyCohortAdmin(ModelAdmin):
    list_display = ["name", "course", "facilitator", "status", "released_week", "start_date"]
    list_filter = ["status"]


@admin.register(AcademyMaterial)
class AcademyMaterialAdmin(ModelAdmin):
    list_display = ["course", "day", "task"]
    list_filter = ["course"]


@admin.register(AcademyEnrollment)
class AcademyEnrollmentAdmin(ModelAdmin):
    list_display = ["user", "cohort", "status", "current_day", "removed"]
    list_filter = ["status", "removed"]


@admin.register(AcademyCertificate)
class AcademyCertificateAdmin(ModelAdmin):
    pass


@admin.register(AcademySubmission)
class AcademySubmissionAdmin(ModelAdmin):
    pass


@admin.register(AcademyJudgment)
class AcademyJudgmentAdmin(ModelAdmin):
    pass


@admin.register(AcademyTeam)
class AcademyTeamAdmin(ModelAdmin):
    pass


@admin.register(AcademyLiveSession)
class AcademyLiveSessionAdmin(ModelAdmin):
    pass


@admin.register(AcademyRosterRequest)
class AcademyRosterRequestAdmin(ModelAdmin):
    pass
