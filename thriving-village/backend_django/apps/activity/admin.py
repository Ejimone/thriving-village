from django.contrib import admin

from .models import ActivityLog


@admin.register(ActivityLog)
class ActivityLogAdmin(admin.ModelAdmin):
    list_display = ["who", "what", "kind", "occurred_at"]
    list_filter = ["kind"]
