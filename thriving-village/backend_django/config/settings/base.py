"""
Base settings shared by local and production. Mirrors the Strapi backend's
env-var-driven config (same Supabase DATABASE_URL, same Upstash Redis, same
Cloudinary/Mux credentials) — see backend/.env and backend/.env.local for the
values this reads. Plan: ~/.claude/plans/now-i-need-us-cheeky-wombat.md
"""

import os
from datetime import timedelta
from pathlib import Path

import dj_database_url
from dotenv import load_dotenv
from django.templatetags.static import static

BASE_DIR = Path(__file__).resolve().parent.parent.parent

load_dotenv(BASE_DIR / ".env")

SECRET_KEY = os.environ.get("DJANGO_SECRET_KEY", "django-insecure-dev-only-override-in-env")
DEBUG = os.environ.get("DJANGO_DEBUG", "false").lower() == "true"
ALLOWED_HOSTS = [h.strip() for h in os.environ.get("DJANGO_ALLOWED_HOSTS", "").split(",") if h.strip()]

INSTALLED_APPS = [
    # Must load before django.contrib.admin — Unfold overrides admin
    # templates/static assets in place rather than replacing admin.site.
    "unfold",
    "unfold.contrib.filters",
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    "rest_framework",
    "rest_framework_simplejwt",
    "django_filters",
    "corsheaders",
    "apps.core",
    "apps.accounts",
    "apps.marketplace",
    "apps.activity",
    "apps.academy",
    "apps.integrations",
]

MIDDLEWARE = [
    "django.middleware.security.SecurityMiddleware",
    # Serves collected static files (Django admin's CSS/JS) directly from the
    # app process — DO App Platform has no separate static-file server/CDN
    # step for a plain Python web service, so WhiteNoise is what makes
    # /admin/ render correctly once deployed (it's a no-op risk locally too:
    # `runserver` already serves static itself in DEBUG, so this only takes
    # over in production).
    "whitenoise.middleware.WhiteNoiseMiddleware",
    "apps.core.middleware.ApiGZipMiddleware",
    "corsheaders.middleware.CorsMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
]

ROOT_URLCONF = "config.urls"

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
            ],
        },
    },
]

WSGI_APPLICATION = "config.wsgi.application"

# Same Supabase Postgres connection Strapi uses today (DATABASE_URL env var name
# matches backend/.env exactly) — Django gets its own freshly-migrated tables in
# the same database/project, per the approved plan. CONN_MAX_AGE keeps connections
# warm across requests, since the lesson from Strapi's perf investigation was that
# per-request round trips to this remote (Singapore) pooler are the expensive part.
DATABASES = {
    "default": dj_database_url.parse(
        os.environ.get("DATABASE_URL", f"sqlite:///{BASE_DIR / 'db.sqlite3'}"),
        conn_max_age=int(os.environ.get("DB_CONN_MAX_AGE", "600")),
        # Without health checks, a pooled connection the Supabase pooler
        # dropped during idle gets discovered mid-request as an OperationalError
        # (a full failed round trip + retry). The ping costs ~nothing against
        # a warm connection and only runs once per request.
        conn_health_checks=True,
        ssl_require=os.environ.get("DATABASE_SSL", "false").lower() == "true",
    )
}

# Sessions only exist for the Django admin (the API is JWT-authenticated,
# stateless). cached_db keeps the DB row as the source of truth but serves
# every read from Redis — one fewer remote-Postgres round trip on every
# /admin/ request, which against the remote pooler is the dominant cost.
SESSION_ENGINE = "django.contrib.sessions.backends.cached_db"

AUTH_USER_MODEL = "accounts.User"

AUTH_PASSWORD_VALIDATORS = [
    {"NAME": "django.contrib.auth.password_validation.UserAttributeSimilarityValidator"},
    {"NAME": "django.contrib.auth.password_validation.MinimumLengthValidator"},
    {"NAME": "django.contrib.auth.password_validation.CommonPasswordValidator"},
    {"NAME": "django.contrib.auth.password_validation.NumericPasswordValidator"},
]

# Strapi hashed passwords with bcrypt — listing it first (alongside Django's
# native hasher) lets the one-time ETL carry bcrypt hashes over as-is; Django
# verifies them natively and silently upgrades to its default hasher on next
# login, per the plan's ETL section (no forced password reset).
PASSWORD_HASHERS = [
    "django.contrib.auth.hashers.BCryptSHA256PasswordHasher",
    # Plain (no SHA256 pre-hash) bcrypt — required to verify the raw `$2a$`/
    # `$2b$` hashes carried over as-is from Strapi's bcryptjs by the ETL
    # script (apps/core/management/commands/etl_from_strapi.py), which never
    # ran them through Django's SHA256 pre-hash step. Listed second (not
    # first) so Django still encodes any *new* password with
    # BCryptSHA256PasswordHasher — existing migrated users transparently
    # upgrade to that on their next successful login, same as Django's
    # normal hasher-upgrade behavior.
    "django.contrib.auth.hashers.BCryptPasswordHasher",
    "django.contrib.auth.hashers.PBKDF2PasswordHasher",
    "django.contrib.auth.hashers.PBKDF2SHA1PasswordHasher",
]

LANGUAGE_CODE = "en-us"
TIME_ZONE = "UTC"
USE_I18N = True
USE_TZ = True

STATIC_URL = "static/"
STATIC_ROOT = BASE_DIR / "staticfiles"
STATICFILES_DIRS = [BASE_DIR / "static"]
STORAGES = {
    "default": {"BACKEND": "django.core.files.storage.FileSystemStorage"},
    "staticfiles": {"BACKEND": "whitenoise.storage.CompressedManifestStaticFilesStorage"},
}

# Restyles django.contrib.admin in place (same admin.py registrations, same
# /admin/ URL) to match the frontend's design tokens (src/app/globals.css):
# neutrals-first, no bright accent color, 12px radius, Instrument Sans +
# Libre Baskerville. Colors below are RGB triplets read directly off that
# file's :root block, not approximations.
UNFOLD = {
    "SITE_TITLE": "Thriving Village",
    "SITE_HEADER": "Thriving Village",
    "BORDER_RADIUS": "12px",  # --tv-radius-sm
    "COLORS": {
        "font": {
            "subtle-light": "122 122 122",  # --tv-gray-500
            "subtle-dark": "199 199 199",  # --tv-gray-300
            "default-light": "10 10 10",  # --tv-black
            "default-dark": "255 255 255",  # --tv-white
            "important-light": "10 10 10",
            "important-dark": "255 255 255",
        },
        # Neutral black/gray ramp as the "primary" — the frontend's own rule
        # is that accents (blue/orange/green/yellow/magenta) are rare, one
        # per page, never a system-wide brand color, so the admin's primary
        # is driven by the same gray ramp as everything else.
        "primary": {
            "50": "248 248 246", "100": "242 242 239", "200": "226 226 223",
            "300": "199 199 199", "400": "160 160 160", "500": "122 122 122",
            "600": "92 92 92", "700": "64 64 64", "800": "43 43 43",
            "900": "28 28 28", "950": "17 17 17",
        },
        "base": {
            "50": "248 248 246", "100": "242 242 239", "200": "226 226 223",
            "300": "199 199 199", "400": "160 160 160", "500": "122 122 122",
            "600": "92 92 92", "700": "64 64 64", "800": "43 43 43",
            "900": "28 28 28", "950": "17 17 17",
        },
    },
    "STYLES": [
        lambda request: static("css/admin-theme.css"),
    ],
}

DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"

# CORS: same frontend origins that currently call Strapi directly for the SSE
# proxy routes; same-origin server-side calls from Next.js server actions don't
# need this, but keep it explicit rather than assuming nothing calls cross-origin.
CORS_ALLOWED_ORIGINS = [o.strip() for o in os.environ.get("CORS_ALLOWED_ORIGINS", "").split(",") if o.strip()]

REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": (
        "apps.accounts.authentication.CachedJWTAuthentication",
    ),
    "DEFAULT_PERMISSION_CLASSES": ("rest_framework.permissions.IsAuthenticatedOrReadOnly",),
    "DEFAULT_PAGINATION_CLASS": "apps.core.pagination.StrapiStylePagination",
    "PAGE_SIZE": 25,
    "DEFAULT_FILTER_BACKENDS": (
        "django_filters.rest_framework.DjangoFilterBackend",
        "rest_framework.filters.OrderingFilter",
        "rest_framework.filters.SearchFilter",
    ),
    "EXCEPTION_HANDLER": "apps.core.exceptions.envelope_exception_handler",
    # No default throttle classes — only the views that opt in (password
    # reset / auth endpoints) declare throttle_classes themselves.
    "DEFAULT_THROTTLE_RATES": {
        "auth-burst": "10/min",
        "password-reset": "5/hour",
    },
}

# HS256 + same secret-naming convention as Strapi's JWT_SECRET, fully native
# Django auth otherwise (no attempt at byte-compatibility with old Strapi
# tokens — confirmed decision: one-time forced re-login at cutover).
SIMPLE_JWT = {
    "ACCESS_TOKEN_LIFETIME": timedelta(days=30),
    "REFRESH_TOKEN_LIFETIME": timedelta(days=90),
    "ALGORITHM": "HS256",
    "SIGNING_KEY": os.environ.get("JWT_SECRET", SECRET_KEY),
    "USER_ID_FIELD": "id",
    "USER_ID_CLAIM": "id",
}

# Upstash Redis, standard protocol (not the REST API Strapi's edge-constrained
# client needed) — same instance, reused credentials. Degrades to local memory
# cache if not configured, matching Strapi's cache.ts "optional, no-op if unset"
# behavior for local dev.
UPSTASH_REDIS_URL = os.environ.get("UPSTASH_REDIS_URL")
_redis_url = UPSTASH_REDIS_URL
if _redis_url:
    CACHES = {
        "default": {
            "BACKEND": "django_redis.cache.RedisCache",
            "LOCATION": _redis_url,
            "OPTIONS": {"CLIENT_CLASS": "django_redis.client.DefaultClient"},
        }
    }
else:
    CACHES = {"default": {"BACKEND": "django.core.cache.backends.locmem.LocMemCache"}}

# Reused third-party credentials (same accounts as the Strapi backend) —
# Cloudinary uploads (CVs, contest entry files) and Mux video (Academy lessons).
CLOUDINARY_CLOUD_NAME = os.environ.get("CLOUDINARY_CLOUD_NAME")
CLOUDINARY_API_KEY = os.environ.get("CLOUDINARY_API_KEY")
CLOUDINARY_API_SECRET = os.environ.get("CLOUDINARY_API_SECRET")

MUX_TOKEN_ID = os.environ.get("MUX_TOKEN_ID")
MUX_TOKEN_SECRET = os.environ.get("MUX_TOKEN_TOKEN_SECRET")
MUX_SIGNING_KEY_ID = os.environ.get("MUX_KEY_ID")
MUX_SIGNING_KEY_PRIVATE = os.environ.get("MUX_SIGNING_SECRET_KEY")  # base64-encoded PEM, decoded in mux_client.py
MUX_WEBHOOK_SECRET = os.environ.get("MUX_WEBHOOK_SECRET")
ACADEMY_FRONTEND_ORIGIN = os.environ.get("ACADEMY_FRONTEND_ORIGIN")

# --- Email (password reset). SMTP when EMAIL_HOST is configured; falls back
# to the console backend so local dev prints the reset email (and its code)
# to the runserver terminal instead of failing.
if os.environ.get("EMAIL_HOST"):
    EMAIL_BACKEND = "django.core.mail.backends.smtp.EmailBackend"
    EMAIL_HOST = os.environ["EMAIL_HOST"]
    EMAIL_PORT = int(os.environ.get("EMAIL_PORT", "587"))
    EMAIL_HOST_USER = os.environ.get("EMAIL_HOST_USER", "")
    EMAIL_HOST_PASSWORD = os.environ.get("EMAIL_HOST_PASSWORD", "")
    EMAIL_USE_TLS = os.environ.get("EMAIL_USE_TLS", "true").lower() == "true"
    EMAIL_USE_SSL = os.environ.get("EMAIL_USE_SSL", "false").lower() == "true"
    EMAIL_TIMEOUT = int(os.environ.get("EMAIL_TIMEOUT", "10"))
else:
    EMAIL_BACKEND = "django.core.mail.backends.console.EmailBackend"
DEFAULT_FROM_EMAIL = os.environ.get("DEFAULT_FROM_EMAIL", "Thriving Village <no-reply@thrivingvillage.local>")

# Where password-reset links point. FRONTEND_URL covers the main Next.js app;
# the Academy frontend reuses ACADEMY_FRONTEND_ORIGIN above (falls back to
# FRONTEND_URL when unset, since locally they're often the same app).
FRONTEND_URL = os.environ.get("FRONTEND_URL", "http://localhost:3000")

# Reset codes are single-use by construction (they hash the user's current
# password) and additionally expire after this many seconds.
PASSWORD_RESET_TIMEOUT = int(os.environ.get("PASSWORD_RESET_TIMEOUT", str(60 * 60 * 2)))

# --- Supabase Auth (optional). When configured, POST /api/auth/supabase and
# /api/academy/auth/supabase exchange a Supabase access token (from
# supabase-js signUp/signInWithPassword/OAuth) for this backend's own JWT.
# Verification prefers the project's JWKS endpoint (new asymmetric keys) and
# falls back to the legacy HS256 JWT secret when SUPABASE_JWT_SECRET is set.
SUPABASE_URL = os.environ.get("SUPABASE_URL")
SUPABASE_JWT_SECRET = os.environ.get("SUPABASE_JWT_SECRET")
SUPABASE_ANON_KEY = os.environ.get("SUPABASE_ANON_KEY")
