# Backend performance & auth changes

_Branch: `feat/perf-and-auth` · July 2026_

This document covers two workstreams applied to `backend_django/`:

1. **Performance** — database queries, connection handling, session management, caching.
2. **Auth** — Supabase authentication (email signup with confirmation emails), and
   password reset for both realms (main marketplace users and Academy users).

Everything is verified by the test suite (`apps/accounts/tests.py`, 15 tests) plus a
live end-to-end smoke test (register → forgot-password → email → reset → login, and a
real Supabase ES256 access token exchanged for a backend JWT).

---

## 1. Performance

### 1.1 Database connections (`config/settings/base.py`)

- `conn_health_checks=True` on the default database. With `CONN_MAX_AGE=600` against
  the remote Supabase pooler, a silently-dropped idle connection used to surface as an
  `OperationalError` mid-request. Django now pings once per request and transparently
  reconnects. `CONN_MAX_AGE` is also env-overridable via `DB_CONN_MAX_AGE`.

### 1.2 Session management

- `SESSION_ENGINE = "cached_db"`. Sessions only exist for the Django admin (the API is
  JWT-based and stateless). Every `/admin/` request previously did a session-row read
  from remote Postgres; those reads now come from Redis (Upstash), with the DB still
  the durable source of truth. The API paths are unaffected.

### 1.3 Query fixes

| Where | Before | After |
|---|---|---|
| `AcademyAdminTopRatedView` (`/api/academy-admin/top-rated`) | Loaded **every judgment ever** with a 3-table join into Python and aggregated there | Single `GROUP BY` with `Avg()` in Postgres, `LIMIT 10` |
| `AcademyAdminApplicationsView` (`/api/academy-admin/applications`) | One extra `COUNT` query **per waitlisted row** (N+1) | One query — `with_waitlist_positions()` annotates position via subquery |
| `MyAcademyApplicationsView` (`/api/me/academy-applications`) | Same N+1 per row | Same single-query annotation |
| `AcademyLoginView` (`/api/academy/auth/local`) | Ran bcrypt `check_password` **twice** per successful login (~doubles login latency; bcrypt is deliberately slow) | Exactly once |
| `rollout_to_week()` (daily cron + manual rollout) | One `UPDATE` per advanced student | Single `bulk_update` per cohort |

### 1.4 New database indexes

Migrations: `academy/0006_*`, `activity/0005_*` — **run `python manage.py migrate` to
apply them** (they were intentionally not applied to the shared Supabase database from
the dev machine).

| Table | Index | Serves |
|---|---|---|
| `academy_academysubmission` | `(rated, submitted_at)` | Judge queue (`rated=False ORDER BY submitted_at LIMIT 50`) |
| `academy_academyapplication` | `(course, status, created_at)` | Waitlist position counts, `promote()` FIFO scan |
| `academy_academyenrollment` | `(cohort, removed)` | Roster, top-rated, early-access, seat counting |
| `academy_academycohort` | `(course, status, start_date)` | `get_open_cohort()` / apply / promote |
| `activity_activitylog` | `(-occurred_at)` and `(kind, -occurred_at)` | Every dashboard "latest activity" read |

### 1.5 Cache-registry atomicity (`apps/core/cache.py`)

The per-scope key registry (used by `invalidate_scope`) was a pickled Python `set`
updated with read-modify-write — racy under concurrency (lost registrations → stale
cache surviving invalidation) and it re-serialized the whole registry on every cached
read. When Redis backs the cache it now uses native `SADD`/`SMEMBERS` (atomic, O(1)
per key). The portable fallback for LocMemCache in dev is unchanged.

---

## 2. Auth

### 2.1 Password reset (both realms)

Stateless, single-use, expiring reset codes; no schema changes.

| Endpoint | Realm |
|---|---|
| `POST /api/auth/forgot-password` | main (talent / employer / admin) |
| `POST /api/auth/reset-password` | main |
| `POST /api/academy/auth/forgot-password` | Academy (student / facilitator / judge) |
| `POST /api/academy/auth/reset-password` | Academy |

**Flow**

1. `forgot-password` with `{"email": "..."}` → always `{"ok": true}` (same response
   whether or not the account exists — no email enumeration). If the account exists
   and is active/unblocked, an email is sent (async, off the request thread) with a
   link `{FRONTEND}/reset-password?code=<code>`.
2. `reset-password` with `{"code": "...", "password": "...", "passwordConfirmation": "..."}`
   → on success returns `{jwt, user}` (same envelope as login — the user is signed in
   immediately). Field names match Strapi's reset-password contract.

**Code design** (`apps/accounts/tokens.py`): `<uidb64>.<token>` using Django's
`PasswordResetTokenGenerator`, which hashes the user's current password hash — so a
code dies the moment the password changes (single-use) and after
`PASSWORD_RESET_TIMEOUT` (default 2h). Each realm has its own salt: an Academy code
can never reset a main user with the same numeric id, and vice versa.

**Errors**: invalid/expired/reused code → `400`; blocked account → `403`;
mismatched confirmation → `400` (DRF validation envelope).

**Rate limiting**: `forgot-password` 5/hour per IP; `reset-password` and the Supabase
exchange 10/min per IP (DRF throttles, configured in `REST_FRAMEWORK`).

**Email** (`apps/accounts/emails.py` + settings): SMTP when `EMAIL_HOST` is set
(`EMAIL_PORT`, `EMAIL_HOST_USER`, `EMAIL_HOST_PASSWORD`, `EMAIL_USE_TLS`,
`DEFAULT_FROM_EMAIL`); falls back to the console backend in dev, so the reset email —
including the code — prints in the `runserver` terminal. Sending happens on a daemon
thread so a slow SMTP server can't stall (or time-fingerprint) the response.

> **Production TODO:** set the `EMAIL_*` vars on DigitalOcean (any SMTP provider —
> Resend, Postmark, SES, Gmail app-password all work) and set `FRONTEND_URL` (and
> `ACADEMY_FRONTEND_ORIGIN` for Academy links) so emailed links point at the real apps.

### 2.2 Supabase authentication (email signup + confirmation)

The backend keeps issuing its **own** JWTs; Supabase Auth is an additional identity
provider in front. The frontend uses `supabase-js` for `signUp` (Supabase sends the
confirmation email) / `signInWithPassword` / OAuth, then trades the Supabase access
token for a backend JWT:

| Endpoint | Realm | Creates on first exchange |
|---|---|---|
| `POST /api/auth/supabase` | main | `User` — `role` from body (`talent`/`employer`, default `talent`) |
| `POST /api/academy/auth/supabase` | Academy | `AcademyUser` — always `student` |

Body: `{"access_token": "<supabase access token>", "username"?: "...", "role"?: "..."}`
Response: `{jwt, user}` — identical to `/api/auth/local`, so everything downstream
(cookie session, `Authorization: Bearer`, role redirects) is unchanged.

Behavior:

- **Find-or-create by email.** Existing rows (including ETL-migrated Strapi users)
  just link — no duplicates. New rows get username from the body, then Supabase
  `user_metadata.username` / `.full_name`, then the email local part (deduped with a
  numeric suffix), and **no usable local password** (Supabase holds the credential;
  a password reset later also works and adds one).
- **Blocked users** are rejected (`403`) even with a valid Supabase token.
- Token verification (`apps/accounts/supabase.py`): ES256/RS256 via the project JWKS
  (fetched with `requests`, cached in-process for 1h, rotation-safe) with HS256
  legacy-secret fallback (`SUPABASE_JWT_SECRET`). Invalid tokens → `401`; Supabase not
  configured → `501`.
- Because Supabase only issues an access token **after** email confirmation (with
  "Confirm email" enabled, as it is on this project), an exchanged account is by
  construction email-verified.

New env vars (already added to `backend_django/.env`):

```
SUPABASE_URL=https://lxanqtesqozarxdnqcpm.supabase.co
SUPABASE_ANON_KEY=sb_publishable_UcW0njDbLrri96CflnXzOg_Sn1LnxA1   # frontend uses this, not the backend
FRONTEND_URL=http://localhost:3000
# SUPABASE_JWT_SECRET=   # only needed if the project still signs HS256 tokens
```

Classic `POST /api/auth/register` / `POST /api/academy/auth/register` (instant, no
email confirmation) remain untouched — the two paths coexist.

### 2.3 Also fixed along the way

- `apps/accounts/migrations/0002_academyuser.py` used Postgres-only SQL
  unconditionally, which made the test suite impossible to run on sqlite. Now
  vendor-guarded (no behavior change on Postgres).

---

## 3. How to verify locally

```bash
cd backend_django

# unit/integration tests on sqlite
DATABASE_URL="sqlite:///$(pwd)/test.sqlite3" DATABASE_SSL=false UPSTASH_REDIS_URL= \
  .venv/bin/python manage.py test apps

# live flow (console email backend prints the reset email in this terminal)
.venv/bin/python manage.py runserver
curl -X POST localhost:8000/api/academy/auth/forgot-password \
  -H 'Content-Type: application/json' -d '{"email":"<existing user email>"}'
# copy the code from the printed email, then:
curl -X POST localhost:8000/api/academy/auth/reset-password \
  -H 'Content-Type: application/json' \
  -d '{"code":"<code>","password":"new-pass-1","passwordConfirmation":"new-pass-1"}'
```

## 4. Deployment checklist

- [ ] `python manage.py migrate` (new index migrations: `academy/0006`, `activity/0005`)
- [ ] Set `EMAIL_HOST` / `EMAIL_PORT` / `EMAIL_HOST_USER` / `EMAIL_HOST_PASSWORD` /
      `DEFAULT_FROM_EMAIL` on the server
- [ ] Set `FRONTEND_URL` (main app) and `ACADEMY_FRONTEND_ORIGIN` (academy app) to the
      deployed origins so reset links are correct
- [ ] Set `SUPABASE_URL` on the server (same value as `.env`)
- [ ] Frontends get `NEXT_PUBLIC_SUPABASE_URL` + `NEXT_PUBLIC_SUPABASE_ANON_KEY`
