from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as DjangoUserAdmin

from .models import User


@admin.register(User)
class UserAdmin(DjangoUserAdmin):
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
