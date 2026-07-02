# Setup guide: DigitalOcean env vars, email (SMTP), and Supabase Auth

## 1. How the auth stack fits together (what "using Supabase authentication" means here)

You are using Supabase Auth as the **identity provider**, while the Django backend
remains the source of truth for app accounts and issues its **own** JWTs:

```
signup:  Next.js → Supabase (/auth/v1/signup) → confirmation email → user clicks link
         → /auth/callback → POST /api/auth/supabase (Django verifies the Supabase
         token, creates/links the account) → Django JWT in the tv_jwt cookie

signin:  Next.js → Django /api/auth/local first; if the account has no local
         password (Supabase-created), falls back to Supabase password grant
         → exchange → Django JWT

resets:  fully Django-side (works for ALL accounts, including pre-Supabase ones):
         /api/auth/forgot-password → email link → /api/auth/reset-password
```

So: Supabase handles signup credentials + confirmation emails; Django handles
authorization, roles, and every API call. Password-reset emails are sent by Django
itself over SMTP (section 3), **not** by Supabase — because most existing users only
exist in Django's tables, not in Supabase Auth.

## 2. Supabase dashboard setup (one-time, ~5 minutes)

Project: `lxanqtesqozarxdnqcpm` (the one whose Postgres the backend already uses).

1. **Auth → Sign In / Up → Email**: make sure **Email** provider is enabled and
   **"Confirm email"** is ON (that's what produces the confirmation email).
2. **Auth → URL Configuration**:
   - **Site URL**: your production frontend, e.g. `https://your-app.vercel.app`
   - **Redirect URLs** (allowlist — confirmation links can only redirect to URLs
     listed here; anything else silently falls back to the Site URL):
     ```
     http://localhost:3000/auth/callback
     https://<your-production-frontend>/auth/callback
     https://<academy-frontend>/auth/callback        (when the academy app adds it)
     ```
3. **Auth → Emails (templates)** *(optional)*: customize the "Confirm signup"
   template. Supabase's built-in email service is fine for development but is
   rate-limited (~a few emails/hour) — for production, set **Auth → Emails → SMTP
   Settings** to the same SMTP provider you configure in section 3.
4. No service-role key is needed anywhere — the backend verifies tokens with the
   project's public JWKS, and the frontend uses only the publishable key.

Environment values (already in the repo's `.env` files):

- Backend (`backend_django/.env`): `SUPABASE_URL=https://lxanqtesqozarxdnqcpm.supabase.co`
- Frontend (`.env.local`): `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`

## 3. Email (SMTP) — pick a provider

Any SMTP provider works. Recommended: **Resend** (free tier 3k emails/month, 5-minute
setup) or **Brevo** (free 300/day). Gmail with an app password also works for testing.

With Resend as the example:

1. Sign up at resend.com → verify your sending domain (or use their onboarding domain
   to test) → create an API key.
2. Your SMTP values are: host `smtp.resend.com`, port `587`, user `resend`,
   password `<the API key>`.

## 4. Setting the env vars on DigitalOcean App Platform

**Via the dashboard:**

1. Go to **cloud.digitalocean.com → Apps →** your backend app.
2. **Settings** tab → pick the backend **component** (the Django service) →
   **Environment Variables** → **Edit**.
3. Add these (click **Encrypt** for the password):

   | Key | Example value |
   |---|---|
   | `EMAIL_HOST` | `smtp.resend.com` |
   | `EMAIL_PORT` | `587` |
   | `EMAIL_HOST_USER` | `resend` |
   | `EMAIL_HOST_PASSWORD` | `re_xxxxxxxxxxxx` *(encrypt)* |
   | `EMAIL_USE_TLS` | `true` |
   | `DEFAULT_FROM_EMAIL` | `Thriving Village <no-reply@yourdomain.com>` |
   | `FRONTEND_URL` | `https://<your main frontend origin>` |
   | `ACADEMY_FRONTEND_ORIGIN` | `https://<your academy frontend origin>` |
   | `SUPABASE_URL` | `https://lxanqtesqozarxdnqcpm.supabase.co` |

4. **Save** — App Platform redeploys automatically with the new vars.

**Or via CLI / app spec** (the repo has `.do/`): add the same keys under the service's
`envs:` in the app spec, e.g.

```yaml
envs:
  - key: EMAIL_HOST
    value: smtp.resend.com
  - key: EMAIL_HOST_PASSWORD
    value: re_xxxxxxxxxxxx
    type: SECRET
  - key: FRONTEND_URL
    value: https://your-app.vercel.app
  # ...etc
```

then `doctl apps update <app-id> --spec .do/app.yaml`.

`FRONTEND_URL` / `ACADEMY_FRONTEND_ORIGIN` control where the emailed reset links
point: `{FRONTEND_URL}/reset-password?code=...` for main users,
`{ACADEMY_FRONTEND_ORIGIN}/reset-password?code=...` for academy users.

**Frontend host (Vercel):** also add `NEXT_PUBLIC_SUPABASE_URL` and
`NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` to the frontend's env settings there.

## 5. Verify after deploying

```bash
# 1. Reset email actually arrives, link points at the right origin
curl -X POST https://<backend>/api/auth/forgot-password \
  -H 'Content-Type: application/json' -d '{"email":"<your real account email>"}'

# 2. Supabase exchange is live (any garbage token should give 401, NOT 501 —
#    501 means SUPABASE_URL isn't set on the server)
curl -X POST https://<backend>/api/auth/supabase \
  -H 'Content-Type: application/json' -d '{"access_token":"x.y.z"}'
```

Then in the browser: sign up with a real email → confirmation email → click →
lands on `/auth/callback` → dashboard.

## 6. Local development

No SMTP needed: without `EMAIL_HOST`, Django prints emails to the `runserver`
terminal (the reset code included). Supabase signup works locally as long as
`http://localhost:3000/auth/callback` is in the Redirect URLs allowlist (step 2.2).
