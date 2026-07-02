from django.conf import settings
from django.contrib.auth import get_user_model
from django.db.models import Q
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.throttling import AnonRateThrottle
from rest_framework.views import APIView
from rest_framework_simplejwt.tokens import RefreshToken

from .emails import send_password_reset
from .models import AcademyUser, Role
from .serializers import (
    ALLOWED_REGISTER_ROLES,
    AcademyMeSerializer,
    AcademyRegisterSerializer,
    ForgotPasswordSerializer,
    LoginSerializer,
    MeSerializer,
    RegisterSerializer,
    ResetPasswordSerializer,
    SupabaseExchangeSerializer,
)
from .supabase import SupabaseNotConfigured, SupabaseTokenError, verify_supabase_token
from .tokens import check_reset_code, make_reset_code

User = get_user_model()


class PasswordResetThrottle(AnonRateThrottle):
    scope = "password-reset"


class AuthBurstThrottle(AnonRateThrottle):
    scope = "auth-burst"


def _issue_jwt(user, realm="main") -> str:
    """Single access token, no refresh-token rotation surfaced to the
    frontend — it only ever stores one `jwt` string (src/lib/session.ts),
    matching how Strapi's plugin issues a single non-expiring-soon token.
    `realm` tags which user table `user.id` belongs to (see
    CachedJWTAuthentication.get_user) — "main" tokens carry no claim at all,
    so every already-issued token keeps working unchanged."""
    token = RefreshToken.for_user(user)
    if realm != "main":
        token["realm"] = realm
    return str(token.access_token)


class RegisterView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        serializer = RegisterSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.save()
        return Response({"jwt": _issue_jwt(user), "user": MeSerializer(user).data})


class LoginView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        serializer = LoginSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        identifier = serializer.validated_data["identifier"]
        password = serializer.validated_data["password"]

        user = User.objects.filter(Q(email__iexact=identifier) | Q(username=identifier)).first()
        if user is None or not user.check_password(password):
            return Response({"error": {"message": "Invalid identifier or password", "status": 400}}, status=400)
        if user.blocked:
            return Response({"error": {"message": "Your account has been blocked", "status": 403}}, status=403)

        return Response({"jwt": _issue_jwt(user), "user": MeSerializer(user).data})


class MeView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        return Response({"data": MeSerializer(request.user).data})


class AcademyRegisterView(APIView):
    """POST /academy/auth/register — student-only self-serve Academy
    signup, backed by AcademyUser instead of User. Mirrors RegisterView."""

    permission_classes = [AllowAny]

    def post(self, request):
        serializer = AcademyRegisterSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.save()
        return Response({"jwt": _issue_jwt(user, realm="academy"), "user": AcademyMeSerializer(user).data})


class AcademyLoginView(APIView):
    """POST /academy/auth/local — checks AcademyUser first (student/
    facilitator/judge). Platform Admin doesn't live in that table — "one
    admin login covers both domains" is an explicit product decision (see
    IsAcademyAdminOrFacilitator's docstring) — so an Admin identifier falls
    back to the main accounts.User table, restricted to role=Admin only
    (talent/employer accounts still can't log in through this endpoint).
    Whichever table matches determines the issued token's realm, so
    CachedJWTAuthentication resolves request.user against the right table
    on every later request."""

    permission_classes = [AllowAny]

    def post(self, request):
        serializer = LoginSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        identifier = serializer.validated_data["identifier"]
        password = serializer.validated_data["password"]

        user = AcademyUser.objects.filter(Q(email__iexact=identifier) | Q(username=identifier)).first()
        realm = "academy"
        # Track the outcome instead of re-running check_password below —
        # bcrypt is deliberately slow, so a second verification of the same
        # credentials doubled login latency for every successful login.
        authenticated = user is not None and user.check_password(password)
        if not authenticated:
            admin = User.objects.filter(
                Q(email__iexact=identifier) | Q(username=identifier), role=Role.ADMIN
            ).first()
            if admin is not None and admin.check_password(password):
                user, realm, authenticated = admin, "main", True

        if not authenticated:
            return Response({"error": {"message": "Invalid identifier or password", "status": 400}}, status=400)
        if user.blocked:
            return Response({"error": {"message": "Your account has been blocked", "status": 403}}, status=403)

        serializer_class = MeSerializer if realm == "main" else AcademyMeSerializer
        return Response({"jwt": _issue_jwt(user, realm=realm), "user": serializer_class(user).data})


class AcademyMeView(APIView):
    """GET /academy/me — mirrors MeView, against AcademyUser."""

    permission_classes = [IsAuthenticated]

    def get(self, request):
        return Response({"data": AcademyMeSerializer(request.user).data})


# --- Password reset (both realms). Codes are stateless, single-use, expiring
# (see tokens.py); email sending is async and the response is identical
# whether or not the email exists, so the endpoint can't be used to probe
# which addresses have accounts.


class _BaseForgotPasswordView(APIView):
    permission_classes = [AllowAny]
    throttle_classes = [PasswordResetThrottle]
    realm = "main"
    user_model = None

    def _reset_base_url(self):
        return settings.FRONTEND_URL

    def post(self, request):
        serializer = ForgotPasswordSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        email = serializer.validated_data["email"].lower()

        user = self.user_model.objects.filter(email__iexact=email).first()
        if user is not None and user.is_active and not user.blocked:
            send_password_reset(user, make_reset_code(user, self.realm), self._reset_base_url())

        return Response({"ok": True})


class ForgotPasswordView(_BaseForgotPasswordView):
    """POST /api/auth/forgot-password — marketplace/admin accounts."""

    user_model = User


class AcademyForgotPasswordView(_BaseForgotPasswordView):
    """POST /api/academy/auth/forgot-password — Academy accounts. Reset links
    point at the Academy frontend when ACADEMY_FRONTEND_ORIGIN is set."""

    realm = "academy"
    user_model = AcademyUser

    def _reset_base_url(self):
        return settings.ACADEMY_FRONTEND_ORIGIN or settings.FRONTEND_URL


class _BaseResetPasswordView(APIView):
    permission_classes = [AllowAny]
    throttle_classes = [AuthBurstThrottle]
    realm = "main"
    user_model = None
    me_serializer = None

    def post(self, request):
        serializer = ResetPasswordSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        user = check_reset_code(serializer.validated_data["code"], self.user_model, self.realm)
        if user is None:
            return Response({"error": {"message": "Invalid or expired reset code", "status": 400}}, status=400)
        if user.blocked or not user.is_active:
            return Response({"error": {"message": "Your account has been blocked", "status": 403}}, status=403)

        user.set_password(serializer.validated_data["password"])
        user.save(update_fields=["password"])

        # Signed in immediately after a successful reset — same {jwt, user}
        # envelope as login, matching Strapi's reset-password behavior.
        return Response({"jwt": _issue_jwt(user, realm=self.realm), "user": self.me_serializer(user).data})


class ResetPasswordView(_BaseResetPasswordView):
    """POST /api/auth/reset-password."""

    user_model = User
    me_serializer = MeSerializer


class AcademyResetPasswordView(_BaseResetPasswordView):
    """POST /api/academy/auth/reset-password."""

    realm = "academy"
    user_model = AcademyUser
    me_serializer = AcademyMeSerializer


# --- Supabase Auth exchange. The frontend signs up / signs in with
# supabase-js (Supabase sends the confirmation email), then trades the
# Supabase access token for this backend's JWT here. Find-or-create by
# email, so it works for brand-new signups and as an alternate login for
# accounts that already exist in these tables.


def _unique_username(model, base: str) -> str:
    candidate = (base or "user").strip()[:140] or "user"
    if not model.objects.filter(username=candidate).exists():
        return candidate
    suffix = 2
    while model.objects.filter(username=f"{candidate}{suffix}").exists():
        suffix += 1
    return f"{candidate}{suffix}"


class _BaseSupabaseExchangeView(APIView):
    permission_classes = [AllowAny]
    throttle_classes = [AuthBurstThrottle]
    realm = "main"
    user_model = None
    me_serializer = None

    def _create_user(self, email: str, username: str, body: dict, metadata: dict):
        raise NotImplementedError

    def post(self, request):
        serializer = SupabaseExchangeSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        try:
            claims = verify_supabase_token(serializer.validated_data["access_token"])
        except SupabaseNotConfigured:
            return Response({"error": {"message": "Supabase auth is not configured", "status": 501}}, status=501)
        except SupabaseTokenError:
            return Response({"error": {"message": "Invalid Supabase token", "status": 401}}, status=401)

        email = (claims.get("email") or "").lower()
        if not email:
            return Response({"error": {"message": "Supabase token has no email", "status": 400}}, status=400)

        user = self.user_model.objects.filter(email__iexact=email).first()
        if user is None:
            metadata = claims.get("user_metadata") or {}
            username = (
                serializer.validated_data.get("username")
                or metadata.get("username")
                or metadata.get("full_name")
                or email.split("@", 1)[0]
            )
            user = self._create_user(
                email, _unique_username(self.user_model, username), serializer.validated_data, metadata
            )

        if user.blocked or not user.is_active:
            return Response({"error": {"message": "Your account has been blocked", "status": 403}}, status=403)

        return Response({"jwt": _issue_jwt(user, realm=self.realm), "user": self.me_serializer(user).data})


class SupabaseExchangeView(_BaseSupabaseExchangeView):
    """POST /api/auth/supabase — marketplace realm. First-time exchanges may
    pass `role` (talent/employer, defaults to talent) and `username`."""

    user_model = User
    me_serializer = MeSerializer

    def _create_user(self, email, username, body, metadata):
        # Role can also ride along in Supabase user_metadata (set at signUp
        # time) — needed because the confirmation-email round trip means the
        # exchange may happen in a fresh context that no longer knows what
        # the user picked on the signup form.
        metadata_role = metadata.get("role") if metadata.get("role") in ALLOWED_REGISTER_ROLES else None
        # No local password — Supabase is the credential holder for these
        # accounts (password login still works if they later do a reset).
        return User.objects.create_user(
            email=email,
            password=None,
            username=username,
            role=body.get("role") or metadata_role or Role.TALENT,
            confirmed=True,
            blocked=False,
        )


class AcademySupabaseExchangeView(_BaseSupabaseExchangeView):
    """POST /api/academy/auth/supabase — Academy realm, students only
    (facilitator/judge stay admin-promoted, same as classic registration)."""

    realm = "academy"
    user_model = AcademyUser
    me_serializer = AcademyMeSerializer

    def _create_user(self, email, username, body, metadata):
        return AcademyUser.objects.create_user(
            email=email,
            password=None,
            username=username,
            role=Role.STUDENT,
            confirmed=True,
            blocked=False,
        )
