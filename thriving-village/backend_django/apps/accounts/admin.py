from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as DjangoUserAdmin
from unfold.admin import ModelAdmin

from .models import AcademyUser, User


@admin.register(User)
class UserAdmin(ModelAdmin, DjangoUserAdmin):
    ordering = ["email"]
    list_display = ["email", "username", "role", "is_staff", "blocked"]
    # Django's built-in UserAdmin defaults to searching first_name/last_name,
    # which this model doesn't have (it has `name` instead) — searching
    # anything previously 500'd with a FieldError. Override with fields that
    # actually exist.
    search_fields = ["email", "username", "name"]
    fieldsets = (
        (None, {"fields": ("email", "username", "password")}),
        ("Profile", {"fields": ("name", "whatsapp", "role")}),
        ("Status", {"fields": ("confirmed", "blocked", "is_active", "is_staff", "is_superuser", "groups", "user_permissions")}),
    )
    add_fieldsets = (
        (None, {"fields": ("email", "username", "password1", "password2", "role")}),
    )


@admin.register(AcademyUser)
class AcademyUserAdmin(ModelAdmin):
    """Separate table from User above — Academy student/facilitator/judge
    accounts only. No password field exposed: accounts are created via the
    /academy/auth/register and academy-admin/users API endpoints (which
    hash correctly via set_password) — this table is for browsing and
    role/status management, not for typing plaintext passwords into a form."""

    ordering = ["email"]
    list_display = ["email", "username", "name", "role", "confirmed", "blocked"]
    list_filter = ["role", "confirmed", "blocked"]
    search_fields = ["email", "username", "name"]
    fields = ["email", "username", "name", "whatsapp", "role", "confirmed", "blocked", "is_active"]
