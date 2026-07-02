# Prompt + API reference for the Academy frontend codebase

Copy everything inside the block below and give it to Claude in the academy frontend
repo. It contains the full API contract — no access to the backend repo is needed.

---

```
The Django backend (the one this app already calls for /api/academy/auth/local,
/api/academy/auth/register, /api/academy/me, etc.) has three new auth capabilities.
Integrate them into this frontend. Use the same API base URL this app already uses
for the existing academy endpoints, and keep the existing session handling — every
new endpoint returns the exact same `{ jwt, user }` envelope as
POST /api/academy/auth/local, where `user` is
`{ id: number, username: string, email: string, role: "Student" | "Facilitator" | "Judge" }`.

────────────────────────────────────────────────────────
1. PASSWORD RESET (build a "Forgot password?" flow)
────────────────────────────────────────────────────────

POST {API_BASE}/api/academy/auth/forgot-password
  Body:     { "email": string }
  Response: 200 { "ok": true }  — ALWAYS, even if the email has no account
            (anti-enumeration). Rate-limited 5/hour/IP → 429 with a DRF error body.
  Effect:   if the account exists, the user gets an email with a link:
            {ACADEMY_ORIGIN}/reset-password?code=<code>
            (the backend's ACADEMY_FRONTEND_ORIGIN env var controls that origin).

POST {API_BASE}/api/academy/auth/reset-password
  Body:     { "code": string, "password": string, "passwordConfirmation": string }
            password min length 6; both fields must match.
  Success:  200 { "jwt": string, "user": {...} }  — sign the user in immediately
            with this, same as after login.
  Errors:   400 { "error": { "message": "Invalid or expired reset code", "status": 400 } }
              (also for a reused code — codes are single-use and expire after 2 hours)
            400 validation envelope when passwords mismatch / too short
            403 { "error": { "message": "Your account has been blocked", "status": 403 } }

UI to build:
  - "Forgot password?" link on the login form → a page/modal asking for email,
    posts to forgot-password, then always shows "If an account exists for that
    email, we've sent a reset link" (do not reveal whether the email exists).
  - /reset-password page that reads ?code= from the URL (also allow manual paste),
    asks for new password + confirmation, posts to reset-password, stores the
    returned jwt/user exactly like the login page does, redirects to the student
    dashboard. Show a clear error state for expired/used codes with a link back
    to the forgot-password page.

────────────────────────────────────────────────────────
2. SUPABASE AUTH (email signup with confirmation email)
────────────────────────────────────────────────────────

The backend now accepts Supabase Auth access tokens and exchanges them for its own
JWT. Supabase project:

  NEXT_PUBLIC_SUPABASE_URL=https://lxanqtesqozarxdnqcpm.supabase.co
  NEXT_PUBLIC_SUPABASE_ANON_KEY=sb_publishable_UcW0njDbLrri96CflnXzOg_Sn1LnxA1

Install @supabase/supabase-js and create a browser client with those two values.

Signup flow (replaces or sits alongside the existing instant
/api/academy/auth/register — keep the old path working; Supabase signup is the
variant WITH email confirmation):
  1. supabase.auth.signUp({ email, password, options: { data: { username } } })
     → Supabase sends the confirmation email. Show "check your email" UI.
     (No session is returned until the email is confirmed.)
  2. After the user confirms (email link redirects back to the app) or on any
     later supabase.auth.signInWithPassword(...), you have a session. Take
     session.access_token and exchange it:

POST {API_BASE}/api/academy/auth/supabase
  Body:     { "access_token": string, "username"?: string }
            username is only used on the very first exchange (account creation);
            pass the username the user chose at signup.
  Success:  200 { "jwt": string, "user": {...} } — role is always "Student" for
            accounts created this way. Store jwt/user exactly like login does.
            Idempotent: exchanging again returns the same user (find-or-create
            by email, no duplicates; existing accounts with that email just link).
  Errors:   401 invalid/expired Supabase token
            403 blocked account
            501 Supabase not configured on the backend

Important: after the exchange, the app talks to the Django backend with the
returned Django JWT for everything, exactly as today. The Supabase session is only
used to obtain access tokens for the exchange — do not send Supabase tokens to any
other backend endpoint.

────────────────────────────────────────────────────────
3. NOTES
────────────────────────────────────────────────────────
- Classic login POST /api/academy/auth/local and register
  POST /api/academy/auth/register are unchanged and keep working.
- All error responses use the envelope { "error": { "message", "status" } } or
  DRF field-validation objects; handle both as this app already does for login.
- The reset-password and supabase-exchange endpoints are rate-limited
  (10/min/IP) → handle 429 by asking the user to retry shortly.
- Also applies to facilitators/judges: password reset works for them; Supabase
  signup always creates students (facilitator/judge stay admin-created).

Afterwards, test: signup via Supabase (confirm email) → exchange → dashboard loads;
forgot-password → email link → reset → auto-signed-in; wrong/reused code → error UI.
```

---

## Same endpoints for the MAIN frontend (this repo), for reference

Identical contracts under the main-realm paths:

- `POST /api/auth/forgot-password` / `POST /api/auth/reset-password` — for
  talent/employer/admin accounts (`user.role`: `"Talent" | "Employer" | "Admin"`).
  Emailed links point at `{FRONTEND_URL}/reset-password?code=...`.
- `POST /api/auth/supabase` — body also accepts `"role": "talent" | "employer"`
  (default `talent`), used only on first exchange.
