from django.contrib.auth import get_user_model
from rest_framework import serializers

from .models import Role

User = get_user_model()

ALLOWED_REGISTER_ROLES = {Role.TALENT, Role.EMPLOYER, Role.STUDENT}


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
