# Thriving Village Academy — API Reference

This is the API contract for the **Academy backend**, a Strapi v5 REST API living
in `backend/` of the `thriving-village` repo, alongside (but mostly isolated
from) the main site's jobs/contests/courses/shop API. It backs a **separate
Academy frontend** you are building in another codebase, working from the
existing design in `academy/` (route screens) and
`academy-components-for frontend/` (components, `CohortProvider.tsx`,
`cohort.ts`).

**Read this instead of `ACADEMY_BACKEND_SPEC.md`** for exact field names and
endpoint shapes — the spec doc was written before implementation and drifted
slightly from what was actually built (e.g. it says `Material.videoUrl`, the
real API field is `externalVideoUrl`). This doc reflects the real, running,
tested implementation. Where the frontend mock (`cohort.ts`) uses a different
field name, that's called out explicitly in §3.

**Base URL:** `http://localhost:1337/api` in local dev (Strapi's default content-API prefix is `/api`).

---

## 1. Auth

Strapi's built-in `users-permissions` plugin. One shared user table across the whole backend; a user's `role` determines what they can do.

**Sign in**
```
POST /api/auth/local
{ "identifier": "<email>", "password": "<password>" }

→ 200 { "jwt": "<token>", "user": { "id": 12, "username": "...", "email": "...", ... } }
```
Send `Authorization: Bearer <jwt>` on every subsequent request.

**Who am I / which role**
```
GET /api/me
→ 200 { "data": { "id": 12, "username": "...", "email": "...", "role": "Student" } }
```
`role` is the human-readable role name (`"Student" | "Facilitator" | "Judge" | "Admin"`). Use this to route the signed-in user to the right screen — there is **no client-side role switching**; the role is assigned server-side.

**Roles & who can create them**
| Role | Who assigns it | Notes |
|---|---|---|
| `student` | **Self-registers** via `POST /api/auth/register`, or admin (§6, always lands as Student) | enrolled in cohorts |
| `facilitator` | Admin only — via `PUT /admin/users/:id/role` (§6), never self-registerable | scoped to cohorts where `cohort.facilitator == self` |
| `judge` | Admin only — same role-change endpoint, never self-registerable | sees only anonymized work |
| `admin` | Admin only — same role-change endpoint, never self-registerable | same `admin` role as the main site — one platform-admin login has full access to both domains |

**Sign up**
```
POST /api/auth/register
{ "username": "...", "email": "...", "password": "...", "role": "student" }
→ 200 { "jwt": "<token>", "user": { "id": 12, "username": "...", "email": "...", "role": { "name": "Student", ... }, ... } }
```
This is a **custom** route (not the stock plugin's `/api/auth/local/register`, which still exists but always assigns the plugin's unrelated default role regardless of any `role` field sent to it — don't use it). `role` accepts `"talent" | "employer" | "student"` only — `facilitator`/`judge`/`admin` are rejected with `400 "role must be one of: talent, employer, student"`. There is no self-serve path to those three; the only way an account becomes one is an admin explicitly changing it after the fact (§6).

**User profile fields** (added on top of Strapi's default user): `name` (string), `whatsapp` (string) — both nullable, settable by an admin. These are what the roster/teammate-contact/certificate features display instead of `username`/email-derived names.

### Implementation guide — reuse the main site's existing auth pattern as-is

The main Thriving Village frontend (this same repo, `src/`) already has a real, working, production-grade auth implementation against this **same Strapi backend**. Don't reinvent this for the Academy frontend — copy these four files into the new codebase and adapt only the 3 things that differ (table below):

- `src/lib/strapi.ts` — the `strapiFetch()` HTTP client
- `src/lib/session.ts` — cookie-based session (`getSession`/`setSession`/`clearSession`)
- `src/lib/actions/auth.ts` — the Server Actions that actually call the backend
- `src/lib/constants.ts` — cookie name + `Role` type constants
- `middleware.ts` — route-level redirect-if-unauthenticated

**1. `strapiFetch()` — the REST client.** One `fetch()` wrapper, no axios/SWR/React Query. Builds the URL from a `STRAPI_URL` env var, adds `Authorization: Bearer <token>` when a token is passed, JSON-encodes the body, wraps every call in a circuit breaker (so a slow/down backend can't pile up in-flight requests), and throws a typed `StrapiError(message, status)` on any non-2xx response by reading Strapi's `{ "error": { "message": "..." } }` shape. Signature:
```ts
strapiFetch<T>(path: string, options?: {
  query?: Record<string, unknown>;   // serialized to Strapi's filters[x][$eq]=y bracket syntax
  token?: string | null;
  method?: "GET" | "POST" | "PUT" | "DELETE";
  body?: Record<string, unknown> | FormData;
  next?: { revalidate?: number | false; tags?: string[] };  // ISR for public/cacheable reads
  noStore?: boolean;                  // for per-user reads/writes — never cached
}): Promise<T>
```

**2. Cookie-based session, not a JS-readable token store.** After sign-in, three cookies are set together:
| Cookie (main site name) | httpOnly | Holds |
|---|---|---|
| `tv_jwt` | ✅ | the raw Strapi JWT |
| `tv_role` | ❌ (client-readable) | the role string from `/api/me` |
| `tv_name` | ❌ | display name |

All set with `{ sameSite: "lax", path: "/", maxAge: 60*60*24*30, secure: NODE_ENV==="production" }`. `getSession()` reads all three back as `{ jwt, role, name } | null`; `clearSession()` deletes all three (sign-out). Server Components/Actions read the JWT straight from the cookie (server-side only — it's httpOnly, so client JS never touches it); the role/name cookies exist so client components can render role-aware UI without an extra round-trip.

**3. Server Actions do the actual sign-in call — copy this verbatim, just change the redirect:**
```ts
"use server";
export async function signInAction(formData: FormData) {
  const identifier = String(formData.get("email") || "").trim();
  const password = String(formData.get("password") || "");
  if (!identifier || !password) return { error: "Email and password are required." };

  let role: Role;
  try {
    const { jwt } = await strapiFetch<{ jwt: string }>("/api/auth/local", {
      method: "POST",
      body: { identifier, password },
    });
    const me = await strapiFetch<{ data: { username?: string; role?: string } }>("/api/me", {
      token: jwt,
      noStore: true,
    });
    role = (me.data.role as Role) || "Student";
    await setSession(jwt, role, me.data.username || "");
  } catch (err) {
    return { error: err instanceof StrapiError ? err.message : "Something went wrong. Please try again." };
  }
  redirect(`/academy/${role.toLowerCase()}`);  // ← the only line that differs from the main site
}
```
Wire it to the sign-in form via `<form action={signInAction}>` (a real Server Action, not an `onSubmit` handler) with named inputs `email`/`password` — exactly how `src/app/auth/signin/page.tsx` already does it for the main site.

**4. Middleware gives a clean redirect UX, but it is NOT the security boundary** — the real enforcement is server-side in this Strapi backend (every endpoint already 403s the wrong role, verified live in §2). Middleware just avoids a network round-trip before bouncing an obviously-unauthenticated request:
```ts
export function middleware(request: NextRequest) {
  const jwt = request.cookies.get(JWT_COOKIE)?.value;
  if (request.nextUrl.pathname.startsWith("/academy") && !jwt) {
    return NextResponse.redirect(new URL("/academy", request.url)); // back to Academy sign-in
  }
  return NextResponse.next();
}
export const config = { matcher: ["/academy/:path*"] };
```

### What's different for the Academy vs. the main site

| | Main site (already built, reference) | Academy (build this) |
|---|---|---|
| Roles from `/api/me` | `"Talent" \| "Employer" \| "Admin"` | `"Student" \| "Facilitator" \| "Judge" \| "Admin"` |
| Post-login redirect | `/admin` or `/dashboard` | `` `/academy/${role.toLowerCase()}` `` → `/academy/student`, `/academy/facilitator`, `/academy/judge`, `/academy/admin` |
| `/api/auth/register` | works (`role: "talent"\|"employer"`) | works for `role: "student"` too — copy `signUpAction` as well, just constrain its role input to `"student"` and redirect to `/academy/student`. Still **rejects** `facilitator`/`judge`/`admin` — no self-serve path for those (see §10) |
| Middleware matcher | `/dashboard/:path*`, `/admin/:path*` | `/academy/:path*` |
| Cookie names | `tv_jwt` / `tv_role` / `tv_name` | reuse the exact same names (different subdomain, no collision risk) or rename to e.g. `ac_jwt`/`ac_role`/`ac_name` — either is fine, the code is identical |

### Replacing the mock sign-in screen

`academy/page.tsx`'s current `signIn()` handler never calls the backend — it just does `router.push("/academy/student")` unconditionally:
```tsx
function signIn(e: React.FormEvent) {
  e.preventDefault();
  if (!email.trim() || !password.trim()) { toast.error(...); return; }
  router.push("/academy/student");   // ← replace this whole handler
}
```
Swap the `<form onSubmit={signIn}>` for `<form action={signInAction}>`, keep the same `email`/`password` `<Input>`s (just give them `name="email"`/`name="password"` so `formData.get(...)` picks them up), and let the action's `redirect()` decide where the user lands based on their real role. Drop (or gate behind `NODE_ENV !== "production"`) the "For review — sign in as" role-switcher block — it currently bypasses auth entirely by routing straight to `/academy/<role>` with no session at all.

---

## 2. Permission matrix (what 403s and what doesn't)

| Capability | Student | Facilitator (own cohorts only) | Judge | Admin |
|---|---|---|---|---|
| Browse categories/courses | ✅ (public, no auth needed) | ✅ | — | ✅ |
| Own enrollments / daily flow | ✅ | — | — | ✅ |
| Submit task | ✅ (own enrollment only) | — | — | — |
| Request early access | ✅ (own) | — | — | — |
| Grant early access | — | ✅ | — | ✅ |
| Roster / student profile / top-rated | — | ✅ | — | ✅ |
| Threshold / shortlist / remove / bulk-remove | — | ✅ | — | ✅ |
| Transfer student(s) to another cohort | — | ✅ | — | ✅ |
| Rollout next week | — | ✅ | — | ✅ |
| Sessions (read) | ✅ (own cohort) | ✅ | — | ✅ |
| Sessions (create) | — | ✅ | — | ✅ |
| Teams match/clear/get | — | ✅ | — | ✅ |
| Teammate contact (own) | ✅ | — | — | — |
| Judge queue / rate | — | — | ✅ | — |
| Material read | ✅ (if enrolled) | ✅ (if theirs) | — | ✅ |
| Material author (write) | — | — | — | ✅ |
| Cohort/course/category CRUD | — | — | — | ✅ |
| Admin overview/top-rated/activity | — | — | — | ✅ |
| Certificate verify | public, no auth | public | public | public |

A facilitator hitting another facilitator's cohort gets **403** (enforced server-side by a policy, not just hidden in the UI — verified by test). Every endpoint below states its required role.

---

## 3. Data types (as the API actually returns them)

Strapi wraps single-resource responses as `{ "data": {...} }` and lists as `{ "data": [...], "meta": { "pagination": {...} } }` for core CRUD routes; custom routes (most of what's below) return plain `{ "data": ... }` with a hand-shaped payload — **check each endpoint's example**, shapes are NOT uniform across the API the way core CRUD is.

### Category
```ts
{ id, documentId, name, slug, blurb, createdAt, updatedAt, publishedAt }
```

### Course (catalogue)
```ts
{
  id, documentId, title, slug,
  months: number,        // 3–6
  certificate: boolean,
  weeksTotal: number,    // months * 4
  daysTotal: number,     // weeksTotal * 7
  category?: { id, name, slug, ... } // populated on some reads, id-only relation otherwise
}
```
**Frontend mapping:** `cohort.ts`'s `CatalogCourse` matches 1:1 except the backend also stores `weeksTotal`/`daysTotal` as real columns (frontend derives them as `months*4`).

### Cohort
```ts
{
  id, documentId, name,           // "Cohort 7"
  weeksTotal, daysTotal,
  startDate: "YYYY-MM-DD",
  status: "Enrolling" | "Running" | "Completed",
  releasedWeek: number,
  minCompletion: number,          // threshold %, default 60
  checkWeeks: number[],           // e.g. [4, 8]
  course: { id, title, slug, ... },
  facilitator: { id, name } | null
}
```
`facilitator` is included on every cohort read (`GET /academy-cohorts`, `GET /academy-cohorts/:documentId`, `GET /facilitator/cohorts`) — `null` if no facilitator has been assigned yet (the admin UI needs this to flag unassigned cohorts). It's also still the ownership field the scoping policy checks server-side; this is just additionally surfacing it in the response. Use the picker at `GET /admin/users?role=Facilitator` (§6) to find an id to assign.

**Frontend mapping:** `Threshold` is **not** a separate object in the API — `minCompletion`/`checkWeeks` live directly on the cohort. `GET/PUT /cohorts/:id/threshold` is just a projection/patch of those two fields.

### Enrollment
```ts
{
  id, documentId,
  status: "In progress" | "Starting soon" | "Completed",
  currentDay: number,
  submittedDays: number[],
  earlyAccessRequested: boolean,
  earlyWeeks: number[],
  removed: boolean,       // the "bin" flag — per (student, cohort)
  shortlisted: boolean,   // per (student, cohort)
}
```
**Frontend mapping:** `cohort.ts`'s frontend models `removed`/`shortlist` as **cohort-level arrays of student ids**. The backend normalizes this to a **boolean per enrollment** instead (the natural shape once it's a real per-student-per-cohort fact in a DB). Roster/bin/shortlist views are just `WHERE cohort=X AND removed=true/false` server-side — the frontend doesn't need to reconstruct an array, the roster endpoint (§5) already returns only active (non-removed) students with a `shortlisted` flag per row.

### Material (admin-authored, per course+day)
```ts
{
  text: string | null,
  externalVideoUrl: string | null,   // ungated YouTube/Vimeo-style link
  task: string | null,
  taskDetail: string | null,
  docs: { label: string, href: string }[],
  hasVideoPlayback: boolean          // true once a Mux asset is ready for this day
}
```
Returns `{ "data": null }` (not 404) if no material has been authored for that day yet.

**Frontend mapping — important field-name drift:** `cohort.ts`/`CohortProvider.tsx`'s `Material.video` is **NOT** the same field as the backend's `externalVideoUrl` 1:1 — the backend supports **two independent video paths**:
- `externalVideoUrl` — a plain link, ungated, exactly like the frontend mock's `video` field today.
- Mux-hosted video — gated/signed, surfaced as `hasVideoPlayback: true` + a separate playback-token fetch (§6). The raw Mux playback ID is never returned by this endpoint (it's a private field server-side).

If material has an `externalVideoUrl`, render it like the mock does today. If `hasVideoPlayback` is true instead (or as well), fetch a playback token and use a Mux-aware player.

### Submission
```ts
{
  id, day, week, task, courseTitle, url, note,
  submittedAt: "<ISO datetime>",
  rated: boolean,
  anonHandle: string   // "Entry A12" — only relevant on the judge queue
}
```

### Judgment
```ts
{ brief: 1-5, craft: 1-5, originality: 1-5, average: number, feedback: string }
```
Never includes which judge gave it — not even to facilitator/admin views.

### Live session
```ts
{ id, title, type: "Live call" | "Workshop", day: string, time: string, host: string, link: string | null }
```
`day`/`time` are free-text labels (e.g. `"Thursday"`, `"6:00 PM WAT"`), matching the mock exactly — not real datetimes yet.

### Team
```ts
{ id, week: number, title: string, members: [{ id, name, email, whatsapp }] }
```

### Certificate (public verify response only)
```ts
{ studentNameSnapshot, courseTitleSnapshot, cohortNameSnapshot, issuedAt }
```
No PDF yet (confirmed decision, deferred — see §7). These are snapshots taken at issuance time, not live joins, so they don't change if the student's name changes later.

### Roster request
```ts
{
  id, status: "Pending" | "Fulfilled" | "Dismissed",
  count: number | null,        // how many students they're asking for
  note: string | null,
  createdAt,
  cohort: { id, name, courseTitle },
  facilitator: { id, name }
}
```
`facilitator`/`cohort` are always resolved server-side (from the JWT and route param,
respectively) at creation — never from the request body. See
[COHORT_MANAGEMENT.md §10](COHORT_MANAGEMENT.md) for the full create/list/admin-review
flow.

---

## 4. Student endpoints

All require `Authorization: Bearer <jwt>` as a `student`-role user, scoped to their own enrollment (any `:id` belonging to someone else → 404, not 403, since the row simply isn't visible to them).

### List my enrollments
```
GET /api/academy-enrollments
→ { "data": [ { id, currentDay, submittedDays, earlyAccessRequested, earlyWeeks, removed, shortlisted, status, ... } ], "meta": { pagination } }
```
This is core Strapi CRUD (`find`), so it returns the standard `{data, meta}` envelope, scoped server-side to `user = self`.

### Get one enrollment
```
GET /api/academy-enrollments/:id
```

### Submit today's task
```
POST /api/enrollments/:id/submissions
{ "day": 11, "url": "https://...", "note": "optional" }

→ 200 { "data": { "currentDay": 12, "submittedDays": [1,2,...,11], "releasedWeek": 2, "earlyWeeks": [] } }
```
**Hard rule:** `day` must equal the enrollment's *current* `currentDay` — submitting any other value returns `400 "You can only submit today's task."` (the server, not the client, is the source of truth for what day it is). The response is the new progression state — use it to re-render the day strip immediately rather than re-fetching.

### List my submissions for an enrollment
```
GET /api/enrollments/:id/submissions
→ { "data": [ { id, day, week, task, url, note, submittedAt, rated, anonHandle } ] }
```

### Request early access
```
POST /api/enrollments/:id/early-access/request
→ { "data": { "earlyAccessRequested": true } }
```

### My teammates (for the current group assignment)
```
GET /api/enrollments/:id/team
→ { "data": [ { id, name, email, whatsapp } ] }   // excludes self
   or { "data": null }                              // not matched into a team yet
```

### Read today's lesson material
```
GET /api/courses/:courseId/days/:day/material
```
`courseId` is the **course's numeric id** (get it from the enrollment's cohort → course relation, or from `/academy-courses` by slug). No auth role restriction beyond "must be enrolled in a cohort running this course" (enforced server-side; facilitators/admins also pass).

### Course curriculum outline (public, no auth required)
```
GET /api/courses/:courseId/curriculum
→ { "data": { "weeksTotal": 12, "daysTotal": 84, "weeks": [ { "week": 1, "days": [ { "day": 1, "hasMaterial": false }, ... ] } ] } }
```
Outline only — no lesson content, just which days have material authored (drives a "has content" badge).

### My cohort's sessions
```
GET /api/cohorts/:id/sessions
→ { "data": [ { id, title, type, day, time, host, link } ] }
```

---

## 5. Facilitator endpoints

All require a `facilitator`-role JWT, and every `:id` is a **cohort id** the facilitator must own (`cohort.facilitator == self`) — checked server-side; a non-owner gets **403** (verified live: a second facilitator account got 403 on both `roster` and `rollout-next-week` for a cohort they don't run). Admin can call all of these too (bypasses the ownership check).

### My cohorts
```
GET /api/facilitator/cohorts
→ { "data": [ { id, name, weeksTotal, daysTotal, startDate, status, releasedWeek, minCompletion, checkWeeks, course: {...} } ] }
```

### Roster
```
GET /api/cohorts/:id/roster
→ { "data": [ { userId, name, dayReached, lastActive, standing: "on-track"|"behind"|"at-risk", shortlisted } ] }
```
Excludes removed (binned) students. `standing` is derived from pace vs. released weeks (≥85% on-track, ≥60% behind, else at-risk — not stored, recomputed each read). `lastActive` is a human label ("today", "2 days ago") derived from the enrollment's `updatedAt`.

### Student profile
```
GET /api/cohorts/:id/students/:uid
→ { "data": { userId, name, dayReached, standing, submissions: [...], judgments: [...] } }
```
`judgments` here never includes which judge gave the score — only `task, brief, craft, originality, average, feedback`.

### Top-rated students (this cohort)
```
GET /api/cohorts/:id/top-rated
→ { "data": [ { userId, name, avgScore } ] }   // sorted desc, only students with ≥1 rated submission
```

### Shortlist / remove / restore / bulk-remove
```
POST /api/cohorts/:id/students/:uid/shortlist   → { "data": { "shortlisted": true|false } }   // toggles
POST /api/cohorts/:id/students/:uid/remove      → { "data": { "removed": true } }
POST /api/cohorts/:id/students/:uid/restore     → { "data": { "removed": false } }
POST /api/cohorts/:id/students/remove-bulk
  { "userIds": [12, 13] }
  → { "data": { "removedCount": 2 } }
```
`:uid` is the **user id**, not the enrollment id.

### Transfer a student to another cohort
```
POST /api/cohorts/:id/students/:uid/transfer
  { "targetCohortId": <cohortId> }
  → { "data": { "cohortId": <targetCohortId>, "currentDay": 16 } }

POST /api/cohorts/:id/students/transfer-bulk
  { "userIds": [12, 13], "targetCohortId": <cohortId> }
  → { "data": { "transferredCount": 2, "skippedUserIds": [] } }
```
Only allowed **to a cohort running the same course** (a different course's curriculum makes `currentDay` meaningless) and **not into a `Completed` cohort**; both reject with 400 otherwise. `currentDay` is recalculated against the target cohort's own `releasedWeek`/`daysTotal`, not carried over verbatim. `removed`/`shortlisted`/`earlyAccessRequested` reset to their defaults on the target side. If the student already has an enrollment in the target cohort, the single-student route 400s and the bulk route adds them to `skippedUserIds` instead of failing the whole batch. Full rules and examples in [`COHORT_MANAGEMENT.md`](COHORT_MANAGEMENT.md).

### Performance threshold
```
GET /api/cohorts/:id/threshold  → { "data": { "minCompletion": 60, "checkWeeks": [4,8] } }
PUT /api/cohorts/:id/threshold
  { "minCompletion": 70, "checkWeeks": [4,8,12] }
  → { "data": { "minCompletion": 70, "checkWeeks": [4,8,12] } }
```

### Rollout next week (manual trigger — also runs automatically via a daily cron)
```
POST /api/cohorts/:id/rollout-next-week
→ { "data": { "releasedWeek": 3 } }
```
Bumps `releasedWeek` by 1 (clamped to `weeksTotal`) and **auto-advances every caught-up student** into the newly released week in the same call — no separate step needed.

### Early access requests (pending, for this cohort)
```
GET /api/cohorts/:id/early-access-requests
→ { "data": [ { enrollmentId, userId, name, currentDay } ] }
```

### Grant early access
```
POST /api/enrollments/:id/early-access/grant
→ { "data": { "earlyWeeks": [3], "currentDay": 15 } }
```
`:id` here is the **enrollment id** (not cohort id) — the ownership check resolves the enrollment's cohort and checks that against the facilitator. Clears `earlyAccessRequested`, unlocks `releasedWeek+1`, and immediately advances `currentDay` if the student was caught up.

### Sessions
```
GET  /api/cohorts/:id/sessions
POST /api/cohorts/:id/sessions
  { "title": "...", "type": "Live call"|"Workshop", "day": "Thursday", "time": "6:00 PM WAT", "host": "...", "link": "https://..." }
```

### Teams
```
POST   /api/cohorts/:id/teams/match   { "teamSize": 3, "title"?: "optional override" }
DELETE /api/cohorts/:id/teams
GET    /api/cohorts/:id/teams         → { "data": [ { id, week, title, members: [{id,name,email,whatsapp}] } ] }
```
`teamsMatch` deletes any existing teams for the cohort first, then chunks the active (non-removed) roster into groups of `teamSize`. Default `title` is `"Week N group project"` where N is the cohort's current `releasedWeek`.

**Manual team editing** (build one team by hand, or edit a match's output without re-running it — `POST /cohorts/:id/teams`, `PUT/DELETE /teams/:teamId`, `POST/DELETE /teams/:teamId/members[/:userId]`) is documented in full in [COHORT_MANAGEMENT.md §9](COHORT_MANAGEMENT.md).

### Roster requests (ask admin for more students)
```
POST /api/cohorts/:id/roster-requests   { "count"?: 5, "note"?: "..." }
GET  /api/cohorts/:id/roster-requests   → { "data": [ <Roster request, §3> ] }    // this cohort's own requests, newest first
```
`facilitator` on the created request is always the calling user (from the JWT), never
client-supplied. Both routes use the same cohort-ownership policy as everything else
under `/cohorts/:id/...` — admin bypasses. Full lifecycle (including the admin-side
review) in [COHORT_MANAGEMENT.md §10](COHORT_MANAGEMENT.md).

### Material authoring (facilitator: read-only; see §6 for admin write)
```
GET /api/courses/:courseId/days/:day/material   — same shape as §4, facilitator just needs to run a cohort for that course
```

---

## 6. Admin endpoints

Requires `admin` role (the **same** admin account used for the main site — confirmed decision: one platform-admin login for both domains).

### Catalogue CRUD (standard Strapi core CRUD)
```
GET/POST/PUT/DELETE /api/academy-categories
GET/POST/PUT/DELETE /api/academy-courses
GET/POST/PUT/DELETE /api/academy-cohorts
GET/POST/PUT/DELETE /api/academy-enrollments    // create/assign a student to a cohort — there's no self-serve enroll endpoint
```
These follow Strapi's standard core-CRUD request/response shape: `POST` body is `{ "data": { ...fields } }`, response is `{ "data": { id, ...fields }, "meta": {} }`.

To create a cohort: `POST /api/academy-cohorts { "data": { "name": "Cohort 8", "course": <courseId>, "facilitator": <userId>, "weeksTotal": 13, "daysTotal": 90, "startDate": "2026-07-01", "status": "Enrolling" } }`.

To enroll a student: `POST /api/academy-enrollments { "data": { "user": <userId>, "cohort": <cohortId>, "status": "Starting soon", "currentDay": 1, "submittedDays": [], "earlyWeeks": [] } }`.

### Delete an enrollment
```
DELETE /api/academy-enrollments/:documentId
→ 204 (no body)
```
This is **not** the normal way to remove a student — that's the soft-remove flow (`POST /cohorts/:id/students/:uid/remove`, sets `removed: true`, keeps the record). This hard-delete exists only for data-hygiene cleanup (e.g. a corrupted/empty enrollment row). Guarded: rejects with **400** if the enrollment has any submissions or a certificate attached:
```json
{ "error": { "status": 400, "name": "BadRequestError", "message": "This enrollment has submissions or a certificate attached and cannot be deleted.", "details": {} } }
```

### Delete a cohort
```
DELETE /api/academy-cohorts/:documentId
→ 204 (no body)
```
Guarded: rejects with **400** if the cohort has any enrollment with `removed: false` (an active student still on the roster):
```json
{ "error": { "status": 400, "name": "BadRequestError", "message": "Remove or transfer all active students before deleting this cohort.", "details": {} } }
```
Remove or transfer every active student first (`POST /cohorts/:id/students/:uid/remove`, or `POST /cohorts/:id/students/:uid/transfer` / `transfer-bulk` to move them to a same-course cohort — see §5) — once zero enrollments have `removed: false`, the delete succeeds. On success, the cohort's live sessions and teams are cascade-deleted along with it (not meaningful on their own without the cohort). Already-removed enrollments are **not** deleted — they're left in place with their `cohort` relation cleared, since enrollment history is the one thing this guard exists to protect.

### Material authoring (write)
```
PUT /api/courses/:courseId/days/:day/material
  { "videoUrl": "https://youtube.com/...", "text": "...", "task": "...", "taskDetail": "...", "docs": [{"label":"...","href":"..."}] }
  → { "data": { ...the material row... } }

DELETE /api/courses/:courseId/days/:day/material → { "data": { "deleted": true } }
```
Note the **request body key is `videoUrl`** (matches the spec doc's naming) even though the stored/returned field is `externalVideoUrl` — the controller maps it on write. Upserts: creates if absent for that (course, day), updates if present.

### Mux video upload (admin authors a lesson video)
```
POST /api/courses/:courseId/days/:day/material/mux-upload
→ { "data": { "uploadUrl": "https://storage.googleapis.com/video-storage-...", "uploadId": "<mux upload id>" } }
```
The admin frontend `PUT`s the raw video file **directly to `uploadUrl`** from the browser (not through this backend). A Mux webhook then fills in the playback id server-side once Mux finishes processing — see §8.

### Platform overview / top-rated / activity
```
GET /api/admin/overview    → { "data": [ {"label":"Categories","value":"5"}, {"label":"Courses","value":"21"}, {"label":"Active cohorts","value":"1"}, {"label":"Students enrolled","value":"14"} ] }
GET /api/admin/top-rated   → { "data": [ { userId, name, avgScore } ] }   // platform-wide, not per-cohort
GET /api/admin/activity    → { "data": [ { who, what, when } ] }          // last 10 Academy events
```
`overview` is cached 90s server-side; writes don't currently bust that cache (acceptable staleness for a stats tile).

### User picker (name search, for admin forms)
```
GET /api/admin/users?role=Facilitator
GET /api/admin/users?role=Student&search=ada
GET /api/admin/users                          // role omitted — searches all 4 Academy roles at once
→ { "data": [ { "id": 30, "name": "Chidi Okafor", "email": "...", "whatsapp": "...", "role": "Facilitator" } ] }
```
`role` is **optional** — one of `Student | Facilitator | Judge | Admin` if given, else `400`;
omit it to search across all four at once (this never includes Talent/Employer main-site
accounts — it's an Academy-only tool). `search` is optional, case-insensitive substring
match on `name` only (not email/username). Every item now includes `role` (the role name).
No pagination — these lists are small. Use this instead of a raw "type a user ID" input
anywhere the admin UI needs to pick a person — assigning a facilitator to a cohort
(`PUT /academy-cohorts/:documentId { "data": { "facilitator": <id> } }`), enrolling a
student (`POST /academy-enrollments`), changing a role (below), or picking team members
(§5/[COHORT_MANAGEMENT.md](COHORT_MANAGEMENT.md)).

### Create an account directly (always Student)
```
POST /api/admin/users
{ "name": "...", "email": "...", "username": "...", "password": "..." }
→ { "data": { "id": 34, "name": "...", "email": "...", "username": "...", "role": "Student" } }
```
All four fields required, else `400`. Rejects with `400 "Email already in use."` /
`400 "Username already in use."` on a duplicate. Password is hashed the same way
`/auth/register` does (goes through the same plugin user service, not a raw insert) —
verified the resulting account can actually sign in via `POST /auth/local`. Never returns
the password/hash. There's no `role` field here — every account created this way starts
as Student; use the role-change endpoint below to promote one.

### Change a user's role
```
PUT /api/admin/users/:id/role
{ "role": "Facilitator" }
→ { "data": { "id": 34, "name": "...", "email": "...", "role": "Facilitator" } }
```
`:id` is the numeric user id. `role` is one of `Student | Facilitator | Judge | Admin`,
else `400`. `404` if the user doesn't exist. This is the **only** way an account becomes
Facilitator/Judge/Admin — both self-registration and admin-created accounts always start
as Student (see above and §1).

### Roster requests — admin side
```
GET /api/admin/roster-requests
→ { "data": [ { "id": 1, "status": "Pending", "count": 5, "note": "...", "createdAt": "...", "cohort": { "id": 1, "name": "Cohort 7", "courseTitle": "Frontend Development" }, "facilitator": { "id": 10, "name": "Chidi Okafor" } } ] }

PUT /api/roster-requests/:id
{ "status": "Fulfilled" }
→ { "data": { "id": 1, "status": "Fulfilled", ... } }
```
`GET` returns every roster request across every cohort, newest first. `PUT`'s `:id` is the
numeric request id; `status` is `"Fulfilled" | "Dismissed"` only (not `"Pending"` — that's
only ever set at creation). This just closes out the request — actually moving students
into the cohort is a separate step via the existing enroll/transfer endpoints (§6/
[COHORT_MANAGEMENT.md §4](COHORT_MANAGEMENT.md)). Full request lifecycle (including the
facilitator-side create/list) is in [COHORT_MANAGEMENT.md §10](COHORT_MANAGEMENT.md).

---

## 7. Judge endpoints

Requires `judge` role. **Hard rule, verified live:** the response never includes the student's name, email, cohort, or any other judge's score — confirmed by inspecting the raw JSON.

### Queue
```
GET /api/judge/queue
→ { "data": [ { "id": "Entry A12", "submissionId": 1, "course": "Frontend Development", "task": "Day 10 task", "week": 2, "submittedAgo": "1 min ago", "url": "https://...", "note": "..." } ] }
```
`id` here is the **anonymous handle**, not a numeric id — display it as the entry's name. `submissionId` is provided separately for the `rate` call below. Only unrated (`rated: false`) submissions appear; an item disappears from everyone's queue the instant any judge rates it (single-judge-rates-once model — confirmed decision).

### Rate
```
POST /api/judge/submissions/:submissionId/rate
  { "scores": { "brief": 4, "craft": 5, "originality": 4 }, "feedback": "Nice work." }
  → { "data": { "average": 4.3 } }
```
`:submissionId` is the numeric id from the queue response (not the anon handle). Re-rating an already-rated submission → `409 Conflict`.

---

## 8. Media

### Images / general files — Cloudinary
Wired as Strapi's global Media Library upload provider. Any standard Strapi media field (none currently on Academy content-types, but available if added later) automatically stores via Cloudinary, not local disk.

### Lesson video — Mux (gated/signed)
Flow:
1. Admin: `POST /courses/:courseId/days/:day/material/mux-upload` → gets `{ uploadUrl, uploadId }`.
2. Admin frontend `PUT`s the video file straight to `uploadUrl` (browser → Mux, not through this backend).
3. Mux processes the video asynchronously, then calls `POST /webhooks/mux` (this backend, signature-verified, not authenticated as a user) on `video.asset.ready` — fills in the material's playback id server-side.
4. Any authorized reader (enrolled student / owning facilitator / admin) calls:
   ```
   GET /api/courses/:courseId/days/:day/material/playback-token
   → { "data": { "token": "<short-lived signed JWT>" } }
   ```
   and feeds `token` + the **publicly-known playback id** (not currently returned by any endpoint — see open item below) into a Mux-aware player (`@mux/mux-player` or `hls.js` against `https://stream.mux.com/{playbackId}.m3u8?token={token}`).

**Open item for the frontend build:** `getPlaybackToken` currently doesn't also return the `playbackId` itself (it's a `private` field server-side and the endpoint only returns the token). The frontend will need either (a) the backend to add `playbackId` to this response, or (b) some other way to know which Mux player to construct against. Flag this back if you hit it — it's a one-line backend fix (drop the `private` annotation or add an explicit field to the response), just not done yet since no frontend existed to consume it.

Until `MUX_WEBHOOK_SECRET` is configured (see `backend/.env.local`), the webhook will reject every call — Direct Upload creation and signed playback token minting both still work without it, only the "tell the backend the video is ready" step is blocked.

---

## 9. Business rules (the parts the shapes don't explain)

**Daily gate.** A student can only ever submit *today's* task (`day === enrollment.currentDay`). After a successful submit, `currentDay` auto-advances to `day+1` **only if** `weekOf(day+1) <= releasedWeek` (or that week is in `earlyWeeks`). Otherwise the student is "caught up" — `currentDay` stays put until the schedule catches up or early access is granted. There is no separate "caught up" field in any response; the frontend can infer it by checking whether `currentDay`'s week is `<= releasedWeek`.

**Weekly rollout.** `releasedWeek` increases either via the facilitator's manual `rollout-next-week` call, or automatically once a day via a server-side cron job that computes the expected week from the cohort's `startDate`. Either path **also auto-advances every caught-up student** in that cohort in the same operation — the frontend doesn't need to separately re-check/re-advance students after a rollout.

**Early access.** Request → grant is a two-step human approval, not automatic. Granting adds exactly `releasedWeek + 1` to the student's `earlyWeeks` (not a range) and immediately re-runs the advance logic for that one student.

**Judge anonymity.** Enforced server-side via denormalized fields (`courseTitle`, `anonHandle` stored directly on the submission at creation time) specifically so the judge-facing query never needs to join through to the enrollment/user/cohort chain at all — it's not just filtered output, the identity-bearing relation is never touched in that code path.

**Facilitator scoping.** Enforced via a route policy that loads the target cohort (or resolves it through the enrollment, for enrollment-scoped routes) and checks `cohort.facilitator.id === currentUser.id`, with an admin bypass. Returns 403, not a silently-filtered empty result.

**Certificates.** Issued automatically (no manual "issue" endpoint) the moment an enrollment's `currentDay` reaches the cohort's `daysTotal`, but only if the course has `certificate: true`. One per enrollment (idempotent — won't double-issue on subsequent calls).

---

## 10. Known gaps / not yet built (confirmed deferred decisions)

- **No self-serve account creation for Facilitator/Judge/Admin** — `/api/auth/register` accepts `talent`/`employer`/`student` only; promotion to the other three roles is admin-only via `PUT /admin/users/:id/role` (§6). `signUpAction` (the main site's pattern, §1) **is** now reusable as-is for Student sign-up — just change the redirect and the allowed `role` value passed in the form; only `facilitator`/`judge`/`admin` still need an admin step after the fact.
- **No self-serve student enrollment** — separately from account creation above, even an existing student account can't join a cohort themselves; an admin/facilitator must create the `academy-enrollment` row. If the new frontend needs this, it's a new endpoint to request, not something already there.
- **No certificate PDF** — `GET /certificates/verify/:code` returns the verifiable record (name/course/cohort/date) only; rendering a certificate document is a frontend concern for now.
- **No real datetime on live sessions** — `day`/`time` are free-text labels, not a parseable date. Fine for display, not sortable/remindable as-is.
- **`getPlaybackToken` doesn't return `playbackId`** — see §8.
- **Single-judge-rates-once** — there's no multi-judge consensus/averaging; whichever judge rates first closes out the item.

---

## 11. Quick start for the frontend build

1. Don't build auth from scratch — copy `src/lib/strapi.ts`, `src/lib/session.ts`, `src/lib/actions/auth.ts` (sign-in only), `src/lib/constants.ts`, and `middleware.ts` from the main site's codebase per §1's implementation guide, change the redirect target and the `Role` type, and wire `academy/page.tsx`'s form to the copied `signInAction`. There are 4 completely separate top-level experiences (student/facilitator/judge/admin), matching the 4 folders already in `academy/`.
2. For the student daily-flow screen, the only state you need per enrollment is what `GET /academy-enrollments/:id` (or the list) already returns — `currentDay`, `submittedDays`, `releasedWeek`, `earlyWeeks` are the same four fields `CohortProvider.tsx`'s `CourseProgress` already models, just server-persisted now. Submitting just calls `POST /enrollments/:id/submissions` and replaces local state with the response — no need to re-implement `normalize()`/`isAvailable()` client-side, the server already ran it.
3. For facilitator/admin/judge screens, each list endpoint already returns display-ready shapes (names resolved, ago-strings computed, standings derived) — minimal client-side transformation needed.
