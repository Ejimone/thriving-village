from django.contrib.auth import get_user_model
from django.db.models import Q
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.tokens import RefreshToken

from .serializers import LoginSerializer, MeSerializer, RegisterSerializer

User = get_user_model()


def _issue_jwt(user) -> str:
    """Single access token, no refresh-token rotation surfaced to the
    frontend — it only ever stores one `jwt` string (src/lib/session.ts),
    matching how Strapi's plugin issues a single non-expiring-soon token."""
    return str(RefreshToken.for_user(user).access_token)


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
            return Response({"error": {"message": "Invalid identifier or password"}}, status=400)
        if user.blocked:
            return Response({"error": {"message": "Your account has been blocked"}}, status=403)

        return Response({"jwt": _issue_jwt(user), "user": MeSerializer(user).data})


class MeView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        return Response({"data": MeSerializer(request.user).data})
