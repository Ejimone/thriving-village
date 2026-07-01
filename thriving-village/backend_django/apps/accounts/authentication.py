from django.contrib.auth import get_user_model
from rest_framework_simplejwt.authentication import JWTAuthentication
from rest_framework_simplejwt.exceptions import InvalidToken
from rest_framework_simplejwt.settings import api_settings

from apps.core.cache import cached

from .models import AcademyUser

User = get_user_model()


class CachedJWTAuthentication(JWTAuthentication):
    """Identical to simplejwt's default auth, except the per-request user
    lookup is cached for 20s. This carries forward the single biggest
    lesson from the Strapi performance investigation: with this database on
    a remote Supabase pooler, an uncached per-request user fetch was costing
    3.7-8s per authenticated request, dwarfing everything else (see
    backend/src/index.ts's cacheAuthLookups). Django needs the same guard
    from day one rather than rediscovering this the same way.

    Two separate auth realms share this one DRF authentication class:
    `User` (platform Admin + marketplace talent/employer) and `AcademyUser`
    (Academy student/facilitator/judge). A `realm` claim on the token
    (absent = "main", set to "academy" by the /academy/auth/* endpoints)
    says which table `user_id` belongs to — without it, the same numeric id
    could mean two different people depending on which table issued it.
    """

    def get_user(self, validated_token):
        user_id = validated_token.get(api_settings.USER_ID_CLAIM)
        if user_id is None:
            raise InvalidToken("Token contained no recognizable user identification")

        realm = validated_token.get("realm", "main")
        user = cached("auth:user", f"{realm}:{user_id}", 60, lambda: self._fetch_user(user_id, realm))
        if user is None:
            raise InvalidToken("User not found")
        if not user.is_active or user.blocked:
            raise InvalidToken("User is inactive or blocked")
        return user

    @staticmethod
    def _fetch_user(user_id, realm):
        model = AcademyUser if realm == "academy" else User
        try:
            return model.objects.get(pk=user_id)
        except model.DoesNotExist:
            return None
