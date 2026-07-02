from django.contrib.auth import get_user_model
from rest_framework import serializers

from .models import AcademyUser, Role

User = get_user_model()

# Student signup moved to AcademyRegisterSerializer/the /academy/auth/*
# endpoints below, backed by the separate AcademyUser table — the main
# register endpoint only ever creates marketplace accounts now.
ALLOWED_REGISTER_ROLES = {Role.TALENT, Role.EMPLOYER}


class RegisterSerializer(serializers.Serializer):
    """Mirrors backend/src/api/me/controllers/auth.ts's `register` action:
    same field names, same ALLOWED_ROLES enum, same "email already taken"
    validation — the built-in djangorestframework-simplejwt has no register
    endpoint of its own, so this is fully custom either way."""

    username = serializers.CharField(min_length=3)
    email = serializers.EmailField()
    password = serializers.CharField(min_length=6, write_only=True)
    role = serializers.ChoiceField(choices=[(r, r) for r in ALLOWED_REGISTER_ROLES])

    def validate_email(self, value):
        value = value.lower()
        if User.objects.filter(email=value).exists():
            raise serializers.ValidationError("Email is already taken.")
        return value

    def validate_username(self, value):
        if User.objects.filter(username=value).exists():
            raise serializers.ValidationError("Username is already taken.")
        return value

    def create(self, validated_data):
        return User.objects.create_user(
            email=validated_data["email"],
            password=validated_data["password"],
            username=validated_data["username"],
            role=validated_data["role"],
            confirmed=True,
            blocked=False,
        )


class LoginSerializer(serializers.Serializer):
    """Mirrors Strapi's built-in /api/auth/local: `identifier` may be either
    email or username, per Strapi's plugin behavior the frontend already
    relies on (src/lib/actions/auth.ts sends the email into `identifier`)."""

    identifier = serializers.CharField()
    password = serializers.CharField(write_only=True)


class MeSerializer(serializers.Serializer):
    """Mirrors backend/src/api/me/controllers/me.ts's `whoami` shape exactly:
    {id, username, email, role} with role as a flat string.

    Strapi's `up_roles` table has both `type` (lowercase, machine — "admin")
    and `name` (capitalized, display — "Admin"); `me.ts` returned `.name`,
    which is what the entire frontend's Role type ("Talent"|"Employer"|
    "Admin") and every `session.role === "Admin"` check was built against.
    Django's Role enum stores the lowercase value (matching `type`) with a
    capitalized label (matching `name`) — `get_role_display()` is Django's
    built-in accessor for that label, so this has to read through it rather
    than the raw `role` attribute, or every role-gated redirect/permission
    check on the frontend silently never matches.
    """

    id = serializers.IntegerField()
    username = serializers.CharField()
    email = serializers.EmailField()
    role = serializers.CharField(source="get_role_display")


class AcademyRegisterSerializer(serializers.Serializer):
    """Student-only self-serve signup for the Academy realm — no `role`
    field at all, always Role.STUDENT. Facilitator/judge accounts stay
    admin-promoted-only (AcademyAdminUserRoleView), matching the
    restriction the old shared-table flow already enforced. Uniqueness is
    scoped to AcademyUser only, independent of the main accounts.User
    table — the two realms were never meant to be the same people."""

    username = serializers.CharField(min_length=3)
    email = serializers.EmailField()
    password = serializers.CharField(min_length=6, write_only=True)

    def validate_email(self, value):
        value = value.lower()
        if AcademyUser.objects.filter(email=value).exists():
            raise serializers.ValidationError("Email is already taken.")
        return value

    def validate_username(self, value):
        if AcademyUser.objects.filter(username=value).exists():
            raise serializers.ValidationError("Username is already taken.")
        return value

    def create(self, validated_data):
        return AcademyUser.objects.create_user(
            email=validated_data["email"],
            password=validated_data["password"],
            username=validated_data["username"],
            role=Role.STUDENT,
            confirmed=True,
            blocked=False,
        )


class AcademyMeSerializer(serializers.Serializer):
    """Same shape as MeSerializer, backed by AcademyUser instead of User."""

    id = serializers.IntegerField()
    username = serializers.CharField()
    email = serializers.EmailField()
    role = serializers.CharField(source="get_role_display")


class ForgotPasswordSerializer(serializers.Serializer):
    email = serializers.EmailField()


class ResetPasswordSerializer(serializers.Serializer):
    """Field names match Strapi's built-in /api/auth/reset-password
    (code / password / passwordConfirmation), so a frontend written against
    Strapi's flow ports over without renames."""

    code = serializers.CharField()
    password = serializers.CharField(min_length=6, write_only=True)
    passwordConfirmation = serializers.CharField(write_only=True)

    def validate(self, attrs):
        if attrs["password"] != attrs["passwordConfirmation"]:
            raise serializers.ValidationError({"passwordConfirmation": "Passwords do not match."})
        return attrs


class SupabaseExchangeSerializer(serializers.Serializer):
    """POST body for /api/auth/supabase — `username`/`role` only matter on
    first exchange (account creation); later exchanges ignore them."""

    access_token = serializers.CharField()
    username = serializers.CharField(min_length=3, required=False, allow_blank=True)
    role = serializers.ChoiceField(choices=[(r, r) for r in ALLOWED_REGISTER_ROLES], required=False)
