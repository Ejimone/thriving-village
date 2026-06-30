from django.contrib.auth import get_user_model
from django.db.models import Q
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.tokens import RefreshToken

from .models import AcademyUser, Role
from .serializers import (
    AcademyMeSerializer,
    AcademyRegisterSerializer,
    LoginSerializer,
    MeSerializer,
    RegisterSerializer,
)

User = get_user_model()


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
        if user is None or not user.check_password(password):
            admin = User.objects.filter(
                Q(email__iexact=identifier) | Q(username=identifier), role=Role.ADMIN
            ).first()
            if admin is not None and admin.check_password(password):
                user, realm = admin, "main"

        if user is None or not user.check_password(password):
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
