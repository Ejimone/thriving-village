"""Supabase Auth access-token verification.

The frontend authenticates against Supabase (supabase-js signUp /
signInWithPassword / OAuth — Supabase handles the confirmation emails), then
exchanges the resulting access token for this backend's own JWT via
POST /api/auth/supabase or /api/academy/auth/supabase. This module only
verifies the Supabase token; user linking lives in views.py.

Verification order:
1. JWKS at {SUPABASE_URL}/auth/v1/.well-known/jwks.json — the modern
   asymmetric signing keys (ES256/RS256). Fetched with `requests` (not
   PyJWT's PyJWKClient, whose urllib fetch trusts only the system SSL store
   and fails on machines without one — requests ships certifi) and cached
   module-wide for an hour, so steady-state verification is purely local
   crypto with no network round trip.
2. HS256 with SUPABASE_JWT_SECRET — legacy projects still on the shared
   secret.
"""

import logging
import time

import jwt
import requests
from django.conf import settings

logger = logging.getLogger(__name__)

_JWKS_TTL_SECONDS = 3600
# Floor between fetches when an unknown `kid` shows up (key rotation), so a
# flood of bad tokens can't turn into a flood of JWKS requests.
_JWKS_RETRY_FLOOR_SECONDS = 60
_jwks_cache: dict = {"keys": {}, "fetched_at": 0.0}


class SupabaseNotConfigured(Exception):
    pass


class SupabaseTokenError(Exception):
    pass


def _get_signing_key(kid: str):
    now = time.time()
    stale = now - _jwks_cache["fetched_at"] > _JWKS_TTL_SECONDS
    unknown_kid = kid not in _jwks_cache["keys"]
    may_refetch = now - _jwks_cache["fetched_at"] > _JWKS_RETRY_FLOOR_SECONDS

    if stale or (unknown_kid and may_refetch):
        url = f"{settings.SUPABASE_URL.rstrip('/')}/auth/v1/.well-known/jwks.json"
        response = requests.get(url, timeout=10)
        response.raise_for_status()
        _jwks_cache["keys"] = {k.get("kid"): jwt.PyJWK(k) for k in response.json().get("keys", [])}
        _jwks_cache["fetched_at"] = now

    return _jwks_cache["keys"].get(kid)


def verify_supabase_token(access_token: str) -> dict:
    """Returns the verified claims dict, or raises SupabaseTokenError /
    SupabaseNotConfigured."""
    if not settings.SUPABASE_URL and not settings.SUPABASE_JWT_SECRET:
        raise SupabaseNotConfigured()

    try:
        header = jwt.get_unverified_header(access_token)
        alg = header.get("alg", "")

        if alg == "HS256":
            if not settings.SUPABASE_JWT_SECRET:
                raise SupabaseTokenError("Token is HS256 but SUPABASE_JWT_SECRET is not configured")
            return jwt.decode(
                access_token,
                settings.SUPABASE_JWT_SECRET,
                algorithms=["HS256"],
                audience="authenticated",
            )

        if not settings.SUPABASE_URL:
            raise SupabaseTokenError("SUPABASE_URL is not configured")
        signing_key = _get_signing_key(header.get("kid", ""))
        if signing_key is None:
            raise SupabaseTokenError("No matching signing key in the project JWKS")
        return jwt.decode(
            access_token,
            signing_key.key,
            algorithms=["ES256", "RS256"],
            audience="authenticated",
        )
    except (SupabaseTokenError, SupabaseNotConfigured):
        raise
    except jwt.PyJWTError as err:
        raise SupabaseTokenError(str(err)) from err
    except Exception as err:  # noqa: BLE001 — JWKS fetch failures etc.
        logger.warning("Supabase token verification failed: %s", err)
        raise SupabaseTokenError("Could not verify token") from err
