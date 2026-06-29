from django.contrib import admin
from unfold.admin import ModelAdmin

from .models import ActivityLog


@admin.register(ActivityLog)
class ActivityLogAdmin(ModelAdmin):
    list_display = ["who", "what", "kind", "occurred_at"]
    list_filter = ["kind"]
