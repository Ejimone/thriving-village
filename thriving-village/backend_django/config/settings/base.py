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

BASE_DIR = Path(__file__).resolve().parent.parent.parent

load_dotenv(BASE_DIR / ".env")

SECRET_KEY = os.environ.get("DJANGO_SECRET_KEY", "django-insecure-dev-only-override-in-env")
DEBUG = os.environ.get("DJANGO_DEBUG", "false").lower() == "true"
ALLOWED_HOSTS = [h.strip() for h in os.environ.get("DJANGO_ALLOWED_HOSTS", "").split(",") if h.strip()]

INSTALLED_APPS = [
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
        conn_max_age=600,
        ssl_require=os.environ.get("DATABASE_SSL", "false").lower() == "true",
    )
}

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
STORAGES = {
    "default": {"BACKEND": "django.core.files.storage.FileSystemStorage"},
    "staticfiles": {"BACKEND": "whitenoise.storage.CompressedManifestStaticFilesStorage"},
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
