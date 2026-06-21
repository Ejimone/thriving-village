# Backend Documentation — Strapi v5

This documents the Strapi backend built at [`backend/`](backend/) against the
contract described in [`BACKEND_INTEGRATION.md`](BACKEND_INTEGRATION.md). It
covers schema, relationships, auth, every custom endpoint, pagination/caching
decisions, known limitations, and what the frontend-integration phase needs to
do next. Read this alongside `BACKEND_INTEGRATION.md` rather than instead of
it — that doc's per-surface checklist (§5) and media notes (§6) still apply.

Strapi version: 5.48.1. Database: Postgres (already configured in
`backend/.env`; SQLite also works via `DATABASE_CLIENT=sqlite`, untouched).
Server: `http://localhost:1337` in dev. All content endpoints are under
`/api/...`; the admin panel is at `/admin` (unrelated to this app's
`/admin/**` Next.js pages — see Auth below).

## Running it

```sh
cd backend
npm run develop          # starts Strapi, auto-reloads on src/ changes
node scripts/seed.js     # idempotent: creates 3 test users + sample catalog rows
```

`scripts/seed.js` boots Strapi headlessly (no HTTP port bound — safe to run
while `develop` is also running) and creates:
- `talent-a@example.com` / `talent-b@example.com` (role `Talent`)
- `admin-seed@example.com` (role `Admin`, manually provisioned — see Auth)
- all passwords: `TestPass123!`
- 2 jobs, 1 draft job (for testing draft-visibility), 1 contest, 1 course, 1
  product, 1 brand, 1 testimonial

Roles and their permissions are created/synced automatically on every boot by
`backend/src/index.ts` (`bootstrap()`) — no manual admin-panel clicking
required for the permission matrix below.

---

## Content-types

All collection types use `documentId` as Strapi's internal identifier.
Job/Contest/Course/Product additionally expose a human-readable `slug` (UID
field) — detail routes (`GET /api/jobs/:id`, etc.) accept **either** the slug
or the documentId; write routes (`PUT`/`DELETE`) from the admin UI use
whatever documentId the list response already gave them.

### Job — `api::job.job`
`title`, `org`, `orgKind`, `field` (`Digital|Technical|Craft|Creative`),
`location`, `locationType` (`Remote|Onsite|Hybrid`), `type`
(`Full-time|Part-time|Contract`), `level` (`Entry|Mid|Senior`), `pay` (free
text), `summary`, `responsibilities` (JSON string[]), `requirements` (JSON
string[]), `slug` (UID on `title`), `status` (`draft|published|closed`,
default `published`).

- `postedAgo` is **computed**, not stored — derived from `createdAt` in the
  `find`/`findOne` response.
- `status: draft` jobs are invisible to everyone except `Admin` (filtered in
  `find`, 404'd in `findOne`). `status: closed` jobs are visible but reject
  new applications.
- No Draft & Publish (Strapi's built-in one) — `status` is the only
  visibility/lifecycle mechanism, to avoid two overlapping concepts.

### Contest — `api::contest.contest`
`title`, `slug`, `field`, `brief`, `rules` (JSON string[]), `deadline`
(datetime), `status` (`live|past`), `entries` (integer, **denormalized
counter**), `prizes` (repeatable component `contest.prize`: `place` int,
`label` string, `amount` decimal), `seed` (string, placeholder-image key).

- `daysLeft`, `prizePool`, `topPrize`, `winnerCount` are **computed** in the
  controller response from `deadline`/`prizes` — never stored.
- `entries` is incremented in the `enter` action's lifecycle, not counted live
  on every read (contest cards are read far more often than entries are
  created).

### Course — `api::course.course`
`title`, `slug`, `field`, `level`, `kind` (`Course|Certification`), `delivery`
(`Online|Onsite|Hybrid`), `location` (optional), `instructor`,
`instructorRole`, `price`, `weeks`, `blurb`, `outcomes` (JSON string[]),
`modules` (repeatable component `course.module`).

**`course.module`** component: `title` + repeatable component `lessons` →
**`course.lesson`**: `key` (string, **required** — admin sets short stable
ids like `l1`, `l2`), `title`, `duration`, `free` (boolean).

- Modules/lessons are **components nested in Course**, not separate
  content-types — a course's curriculum is always read as a whole
  (`populate=modules.lessons`), never paginated or browsed independently. See
  the `key` field note under LessonProgress below for why this needed an
  explicit string id rather than relying on Strapi's internal component id.
- `lessonCount` is computed from `modules`, never stored.
- List view (`GET /api/courses`) never populates `modules` — only the detail
  route (`GET /api/courses/:id`) does. This is the single heaviest payload in
  the schema; keeping it off the catalog/list view is the main pagination
  cost-control decision for this content-type.

### Product — `api::product.product`
`name`, `slug`, `category` (`Apparel|Accessories|Electronics|Tools|Furniture|Home`),
`type` (21-value enum spanning all categories), `price`, `blurb`, `details`
(JSON string[]), `sizes` (JSON string[], optional), `maker` (optional),
`condition` (`New|Used|Refurbished`, default `New`), `brand` (optional),
`shopifyUrl`, `seed`.

- A `beforeCreate`/`beforeUpdate` lifecycle (`content-types/product/lifecycles.ts`)
  rejects any `category`/`type` pair not in the `CATEGORY_TYPES` map mirrored
  from the frontend's `src/lib/data.ts` (e.g. `category: Apparel, type: Laptop`
  → `400 ValidationError`).

### Brand — `api::brand.brand`
`name`, `kind` (`Sister business|Partner`), `industry`, `tagline`, `url`,
`featured` (boolean), `seed`. No slug/detail route — brands only render as
list cards, per the frontend spec.

### Testimonial — `api::testimonial.testimonial`
`quote`, `name`, `role`. Simple, admin-managed, public read.

### Relationship entities

| Content-type | Fields | Uniqueness | Notes |
|---|---|---|---|
| `api::job-application.job-application` | `job` (rel), `user` (rel), `name`, `whatsapp`, `message`?, `cv` (media)?, `status` (`Applied\|In review\|Interview\|Closed`) | `(job, user)`, app-level only | created only via `POST /jobs/:id/apply` |
| `api::contest-entry.contest-entry` | `contest` (rel), `user` (rel), `name`, `whatsapp`, `description`, `work` (media)?, `status` (`Submitted\|Shortlisted\|Won\|Not selected`), `rank` (int, nullable) | `(contest, user)`, app-level only | `rank` set by Admin, drives the leaderboard |
| `api::enrollment.enrollment` | `course` (rel), `user` (rel), `name`, `whatsapp`, `message`? | `(course, user)`, app-level only | no `status`/`progress` field — progress is derived (see below) |
| `api::lesson-progress.lesson-progress` | `user` (rel), `course` (rel), `lessonKey` (string), `completedAt` | `(user, course, lessonKey)`, app-level only | `lessonKey` matched against the course's current `modules[].lessons[].key` at write time |
| `api::saved-job.saved-job` | `job` (rel), `user` (rel) | `(user, job)`, app-level only | toggled via `POST`/`DELETE /saved-jobs` |
| `api::activity-log.activity-log` | `who`, `what` (pre-formatted strings), `kind` (`application\|entry\|enrollment`), `occurredAt` | — | written by `afterCreate`-equivalent calls inside the apply/enter/enroll actions |

**Known gap:** uniqueness above is enforced only in application code (each
write path checks-then-creates), not by a database-level composite unique
index. This was deliberately descoped for this build/test phase — see
"Known limitations" below — and is safe in practice today because every write
to these five content-types goes through a validated custom controller action
(the generic Strapi `create` permission is disabled for everyone but Admin on
all of them), so there's no other path to insert a duplicate row.

---

## Auth & roles

Four Users-Permissions roles, created/synced by `backend/src/index.ts` on
every boot (re-run is idempotent — it only adds/removes `api::*` permission
rows, never touches `plugin::users-permissions.*` ones):

| Role (`type`) | Can read | Can write |
|---|---|---|
| `public` | Job/Contest/Course/Product/Brand/Testimonial (`find`/`findOne`), contest leaderboard | nothing |
| `talent` | everything Public can, plus own JobApplication/ContestEntry/Enrollment/LessonProgress/SavedJob (`find`/`findOne`, scoped to the caller) | apply, enter, enroll, mark progress, save/unsave job |
| `employer` | identical to `talent` for now | identical to `talent` for now |
| `admin` | everything, **unscoped** (sees all users' applications/entries/enrollments/progress), activity log, dashboard stats | full CRUD on Job/Contest/Course/Product/Brand/Testimonial, update on JobApplication/ContestEntry (status/rank) |

`employer` is intentionally its own role (not an alias for `talent`) even
though the permission set is currently identical, so giving employers
job-posting rights later is a permission change, not a schema migration.

`admin` here is a 4th **Users-Permissions** role — not Strapi's own admin
panel login, and not a boolean flag on the user. This keeps one JWT-based auth
system for both the public site and the Next.js `/admin/**` pages (which call
the same `/api/...` endpoints with a bearer token, same as `/dashboard/**`).
Admin accounts are **never** self-served — sign-up only ever resolves to
`talent`/`employer` (see below); provision an Admin by registering normally
and then changing that user's role in the Strapi admin panel (Settings →
Users & Permissions → a user's role), or via `scripts/seed.js`'s pattern.

### Sign-in / sign-up endpoints

- `POST /api/auth/local` — Strapi's built-in login. Body:
  `{ identifier, password }` → `{ jwt, user }`.
- `POST /api/auth/register` — **custom** endpoint
  (`backend/src/api/me/controllers/auth.ts`). Body:
  `{ username, email, password, role }` where `role` is `"talent"` or
  `"employer"` (anything else → `400`). Returns `{ jwt, user }`, same shape as
  the built-in register.

  This exists because Strapi's built-in `POST /api/auth/local/register`
  **always** assigns the plugin's configured default role and silently
  ignores any role in the request body (correct behavior — a client-supplied
  role id used to be a real CVE) — so it can never satisfy this app's signup
  flow, which needs the talent/employer choice from
  `src/app/auth/signup/page.tsx`'s `Role` selector to actually take effect.
  This endpoint resolves the role server-side from a 2-value allow-list
  before creating the user — never trust a client-supplied role id directly.

- `GET /api/me` — **custom**, returns `{ id, email, role }` for the
  authenticated user. Use this (not `/api/users/me?populate=role`) to read a
  user's role: Strapi's content-API output sanitizer strips the `role`
  relation from `/api/users/me` even with `populate=role`/`populate=*`
  (confirmed by testing), because exposing a relation into
  `plugin::users-permissions.role` over the public API requires a permission
  grant on that target content-type that this app intentionally never grants.
  `/api/me` reads `ctx.state.user.role` directly (already populated by the
  JWT auth strategy) and sidesteps that restriction.

---

## Custom routes

| Route | Method | Auth | Body / params | Behavior |
|---|---|---|---|---|
| `/api/auth/register` | POST | none | `{username,email,password,role}` | see above |
| `/api/me` | GET | any signed-in user | — | `{id,email,role}` |
| `/api/jobs/:idOrSlug/apply` | POST | Talent/Employer | `{name,whatsapp,message?}` + optional `cv` file (multipart) | 409 on duplicate, 400 if job `closed`, writes ActivityLog |
| `/api/contests/:idOrSlug/entries` | POST | Talent/Employer | `{name,whatsapp,description}` + optional `work` file | 409 on duplicate, 400 if not `live`/past deadline, increments `entries`, writes ActivityLog |
| `/api/contests/:idOrSlug/leaderboard` | GET | public | — | entries with `rank` set, sorted, each annotated with the matching `prizes[].place` payout |
| `/api/courses/:idOrSlug/enroll` | POST | Talent/Employer | `{name,whatsapp,message?}` | 409 on duplicate, writes ActivityLog |
| `/api/progress` | POST | Talent/Employer | `{courseId,lessonKey}` | 400 if `lessonKey` doesn't exist on that course's current curriculum; idempotent re-mark |
| `/api/saved-jobs` | GET / POST | Talent/Employer | POST: `{jobId}` | GET lists caller's saved jobs (paginated); POST is idempotent |
| `/api/saved-jobs/:jobId` | DELETE | Talent/Employer | — | removes by `(user, jobId)` |
| `/api/me/applications` | GET | Talent/Employer | — | `{jobId,status,appliedAgo}[]` — exact `MY_APPLICATIONS` shape |
| `/api/me/entries` | GET | Talent/Employer | — | `{contestId,status,submittedAgo}[]` — exact `MY_ENTRIES` shape |
| `/api/me/courses` | GET | Talent/Employer | — | `{courseId,progress}[]` — exact `MY_COURSES` shape, `progress` computed from LessonProgress vs. total lesson count |
| `/api/admin-dashboard/stats` | GET | Admin | — | 4 counts (users, applications, enrollments, live contests), 90s in-memory cache |
| `/api/admin-dashboard/activity` | GET | Admin | — | latest 6 ActivityLog rows, `{who,what,when}[]` — exact `ADMIN_ACTIVITY` shape |

All five "write" actions (apply/enter/enroll/progress/save) are the **only**
way to create their respective records — the generic Strapi `create`
permission for JobApplication/ContestEntry/Enrollment/LessonProgress/SavedJob
is granted to no one but Admin, so duplicate-prevention and side effects
(counters, activity log) can't be bypassed by hitting the generic REST
create endpoint directly.

### Example requests

```sh
# sign up as talent
curl -X POST localhost:1337/api/auth/register -H 'Content-Type: application/json' \
  -d '{"username":"ada","email":"ada@example.com","password":"Passw0rd!","role":"talent"}'

# apply to a job (JWT from the response above)
curl -X POST localhost:1337/api/jobs/frontend-developer/apply \
  -H "Authorization: Bearer $JWT" -H 'Content-Type: application/json' \
  -d '{"name":"Ada Okonkwo","whatsapp":"+2348000000000","message":"Excited to apply"}'

# dashboard data in one call each
curl localhost:1337/api/me/applications -H "Authorization: Bearer $JWT"
curl localhost:1337/api/me/courses -H "Authorization: Bearer $JWT"

# admin: list jobs including drafts, then close one
curl localhost:1337/api/jobs -H "Authorization: Bearer $ADMIN_JWT"
curl -X PUT localhost:1337/api/jobs/<documentId> -H "Authorization: Bearer $ADMIN_JWT" \
  -H 'Content-Type: application/json' -d '{"data":{"status":"closed"}}'
```

---

## Pagination & query shaping

`backend/config/api.ts` sets the global default: `defaultLimit: 25`,
`maxLimit: 100` (confirmed capped by testing — requesting `pageSize=999`
returns 100). Every `GET` list response has the standard
`meta.pagination.{page,pageSize,pageCount,total}` envelope, including the
custom `/me/*` and `/saved-jobs` routes (hand-rolled via the `scopedFind`
helper — see "Why a custom scoped-find helper" below).

List views never populate/return their heaviest fields — `modules` (Course),
`responsibilities`/`requirements` (Job), `details` (Product), `rules`/`brief`
(Contest keeps `prizes` on list since it's small, ≤5 rows). Only detail
routes populate them. Filtering (field/locationType/level for Jobs;
field/delivery/kind/level/price-band for Courses; category/type/condition/price-band
for Products) should move to Strapi's native `filters[...]` query params from
the frontend's client-side filter state — e.g.
`GET /api/jobs?filters[field][$eq]=Digital&filters[level][$eq]=Entry`.

---

## Activity log & admin stats

`ADMIN_ACTIVITY` is backed by a real content-type (`activity-log`) written
inline by the apply/enter/enroll actions — one cheap insert per user action,
read back with `ORDER BY occurredAt DESC LIMIT 6` against a small dedicated
table, instead of a `UNION` across three relationship tables on every admin
page load.

`ADMIN_STATS` is **not** stored — it's four live `count()` queries
(`users`, `applications`, `enrollments`, `live contests`), wrapped in a 90-second
in-memory cache in the controller (`admin-dashboard/controllers/admin-dashboard.ts`).
A stored/denormalized stats table was deliberately avoided: it would mean
every application/enrollment write also writes a stats row, for a metric
that's cheap to compute live and read only by admins.

---

## GraphQL — installed, disabled by default

`@strapi/plugin-graphql` is installed and configured in
`backend/config/plugins.ts`, but **`enabled: false`**. While testing, an
unauthenticated `{ jobs { title } }` GraphQL query returned a `status: draft`
job that's correctly hidden from the REST API — the GraphQL plugin generates
resolvers directly off each content-type's service layer, bypassing the
custom logic in `job/controllers/job.ts` (draft filtering), `contest/controllers/contest.ts`
(computed fields, prize population) and `course/controllers/course.ts`
(lessonCount, modules exclusion on list) entirely.

Every screen currently defined is fully served by REST with hand-tuned
`populate`/`fields`/`filters`, so there's no functional need for GraphQL yet.
Flip `enabled: true` only after adding equivalent guards as GraphQL resolver
overrides (`extension.js` / `config.resolvers` in the plugin's config) for at
minimum the Job draft filter — otherwise re-enabling it reintroduces that
leak.

---

## Implementation notes / gotchas (useful if extending this backend)

- **Strapi v5's Users-Permissions `permission` content-type has no `enabled`
  column** — a permission row's mere existence for `(action, role)` grants
  it; there's nothing to toggle. The bootstrap sync in `src/index.ts` creates/
  deletes rows accordingly, and explicitly never touches `plugin::users-permissions.*`
  actions (login/register/etc.) — an earlier version of this script wiped
  those by accident, breaking login entirely, fixed by scoping the sync to
  `api::*` actions only.
- **REST query filters on relations into `plugin::users-permissions.user` are
  rejected** (`400 Invalid key user`) by Strapi's content-API query
  validator, for security — you cannot do `?filters[user][id]=5` against
  e.g. `/api/saved-jobs`. Every "find my own records" controller
  (`saved-job`, `job-application`, `contest-entry`, `enrollment`,
  `lesson-progress`) therefore bypasses `super.find(ctx)` for the list action
  and uses `strapi.db.query(...).findMany()` directly via the shared
  `scopedFind` helper in `backend/src/utils/scoped-find.ts`, which has no such
  restriction and reshapes the result into the same `{data, meta.pagination}`
  envelope.
- **Strapi v5's default `findOne` route resolves `:id` against `documentId`
  only** — it does not know about custom `slug` UID fields. `GET /api/jobs/frontend-developer`
  would otherwise silently return an empty body. Fixed via `resolveSlugParam`
  (same utils file), called at the top of every slug-bearing content-type's
  `findOne` override; it rewrites `ctx.params.id` to the real `documentId`
  when the param matches a `slug`, and leaves it untouched otherwise (so
  documentId-based admin-UI calls keep working unchanged).
- **Components (repeatable or not) are never populated by `strapi.db.query`
  by default**, even when fetching the parent row — you must pass an explicit
  `populate`. This bit both the `contest.leaderboard` action (forgot to
  populate `prizes`, so every leaderboard entry showed `prize: null`) and the
  `lesson-progress.mark` action (forgot to populate `modules.lessons`, so
  every `lessonKey` looked "unknown"). Both are fixed; keep this in mind for
  any new component-bearing content-type.
- **Throw `@strapi/utils`' error classes, not plain `Error`**, in lifecycles/
  controllers — a plain `Error` is caught by Strapi's global error middleware
  as an unhandled exception and returned as an opaque `500 Internal Server
  Error`, masking the real message. `ValidationError`/`ApplicationError`/etc.
  map to clean 400s with the message intact (see `product/content-types/product/lifecycles.ts`).
- **The Users-Permissions plugin rate-limits `/auth/local` and
  `/auth/local/register` to 5 requests / 5 minutes per IP by default** —
  fine in production, actively hostile to manual/automated testing. Relaxed
  in `config/plugins.ts` to only apply when `NODE_ENV === 'production'`.
- **Do not extend the Users-Permissions `user` content-type via a raw
  `src/extensions/users-permissions/content-types/user/schema.json` file**
  without verifying the merge behavior first. Adding one here to store a
  `whatsapp` field caused Strapi's dev-mode schema sync to drop the `email`
  column from `up_users` on restart (silent data loss — confirmed via a
  duplicate-email check after the fact; the affected accounts were this
  session's own seeded test users only). Reverted; `whatsapp` is now only
  captured per-action (on JobApplication/ContestEntry/Enrollment), matching
  the original mock contract, which never modeled a top-level `User` entity
  with a `whatsapp` field anyway. If a future requirement genuinely needs it
  on the account itself, investigate Strapi's officially documented extension
  path for the plugin (`register()` lifecycle mutating the content-type
  programmatically) rather than a schema.json override, and test the migration
  against a disposable database first.

---

## What's next: frontend integration

Per `BACKEND_INTEGRATION.md`, this phase is **not started**. When it begins:

1. Set `STRAPI_URL=http://localhost:1337` (and a prod equivalent) as an env
   var the Next app reads in `src/lib/data.ts`.
2. Replace each `src/lib/data.ts` export with a `fetch` against the routes in
   this doc, keeping the same exported names/types so pages don't change:
   - `JOBS`/`getJob` → `GET /api/jobs` / `GET /api/jobs/:slug`
   - `CONTESTS`/`getContest` → `GET /api/contests` / `:slug`, leaderboard via
     `GET /api/contests/:slug/leaderboard` (replaces the hardcoded
     `LEADERBOARD` array in `contests/[id]/page.tsx`)
   - `COURSES`/`getCourse` → `GET /api/courses` / `:slug`
   - `MY_APPLICATIONS`/`MY_ENTRIES`/`MY_COURSES` → `GET /api/me/applications`
     / `/me/entries` / `/me/courses` (already shaped to match exactly)
   - `ADMIN_STATS`/`ADMIN_ACTIVITY` → `GET /api/admin-dashboard/stats` /
     `/admin-dashboard/activity`
3. Replace `ApplyDialog`'s `submit()` toast with the matching POST route
   (apply/enter/enroll) per BACKEND_INTEGRATION.md §3, using `multipart/form-data`
   when `withFile` is set (the `cv`/`work` field names above).
4. Replace `JobCard`'s local `saved` state with `POST`/`DELETE /api/saved-jobs`.
5. Replace `LessonViewer`'s local `completed` state with `POST /api/progress`,
   hydrating initial state from `GET /api/me/courses` (or a per-lesson lookup
   if finer granularity is needed later).
6. Wire `src/app/auth/signin/page.tsx` to `POST /api/auth/local` and
   `signup/page.tsx` to `POST /api/auth/register` (not Strapi's built-in
   register — see Auth above). Store the JWT + role (from `GET /api/me`) the
   same way for both `/dashboard/**` and `/admin/**` gating, per
   `BACKEND_INTEGRATION.md`'s suggested `middleware.ts` approach — gate
   `/admin/**` on `role === 'Admin'` specifically, not just "any signed-in user."
7. `AdminCrud`'s `save()`/delete handlers map directly onto the standard
   `POST`/`PUT`/`DELETE /api/{jobs,contests,courses,products,brands}/:id`
   routes (Admin-only), using the `documentId` already present in each list
   response.
8. Media: CV/work-sample files upload through Strapi's local Upload provider
   in dev; swap to Cloudflare R2 (per `BACKEND_INTEGRATION.md`'s
   recommendation) by installing and configuring `@strapi/provider-upload-*`
   for production — no application-code change needed, only `config/plugins.ts`.
