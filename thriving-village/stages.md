# Django backend rewrite — progress tracker

Tracks the build described in the approved plan
(`~/.claude/plans/now-i-need-us-cheeky-wombat.md`). Update this file as each
stage starts/finishes — not just at the end — so work can be picked back up
across sessions without re-deriving status from scratch.

Legend: **Not started** / **In progress** / **Done**

---

## Stage 1 — Scaffold + accounts app
**Status:** Done
**What's implemented:**
- Django project scaffolded at `backend_django/` (Python 3.13, Django 6.0.6) with
  `config/settings/{base,local,production}.py` split, `apps/{core,accounts,
  marketplace,activity,academy,integrations}` app skeletons.
- `apps.accounts.User` — custom user model ported 1:1 from Strapi's extended
  users-permissions schema (username, email, password, name, whatsapp, role,
  confirmed, blocked). `Role` choices: talent, employer, admin, student,
  facilitator, judge (the 6 real roles from `backend/src/index.ts`'s
  `ROLE_ACTIONS`; "public" is unauthenticated, not a stored role).
- `PASSWORD_HASHERS` lists bcrypt first so the eventual ETL can carry Strapi's
  existing bcrypt password hashes over verbatim (no forced password reset).
- `POST /api/auth/register`, `POST /api/auth/local`, `GET /api/me` — ported
  field-for-field from `backend/src/api/me/controllers/{auth,me}.ts`
  (same allowed-roles enum, same "identifier" login field, same flat-string
  `role` in the `/api/me` response).
- `apps.core.pagination.StrapiStylePagination` and `apps.core.mixins
  .EnvelopeMixin`/`DocumentIdMixin` — produce Strapi's `{data, meta}` /
  `{data}` envelope shapes so `src/lib/data.ts`'s mapping functions won't
  need changes later.
- `apps.core.exceptions.envelope_exception_handler` — shapes all DRF errors
  as `{error: {message}}`, matching what `strapiFetch` already parses.
- `apps.integrations.circuit_breaker.CircuitBreaker` — line-for-line port of
  `backend/src/utils/circuit-breaker.ts` (thread-lock added since Django can
  run multi-threaded, unlike single-threaded Node).
- `apps.core.cache.cached()`/`invalidate_scope()` — port of
  `backend/src/utils/cache.ts`'s scope-based registry pattern onto
  `django-redis`/Django's cache framework; degrades to LocMemCache when
  `UPSTASH_REDIS_URL` isn't set (matches Strapi's "optional, no-op without
  creds" behavior).
- `apps.accounts.authentication.CachedJWTAuthentication` — wraps simplejwt's
  per-request user lookup in the same 20s cache pattern that fixed Strapi's
  worst latency bug (`cacheAuthLookups` in `backend/src/index.ts`), so Django
  doesn't rediscover that bug later. Verified: cold request ~380ms (real
  Supabase round trip), warm cache hits ~0-10ms.
- `apps.accounts.permissions` — `IsAdminRole`, `IsTalentOrEmployer`,
  `IsStudentRole`, `IsFacilitatorRole`, `IsJudgeRole`,
  `IsAcademyAdminOrFacilitator`, `IsCohortFacilitator` (object-level,
  enforces the ACADEMY_BACKEND_SPEC.md facilitator-scoping hard rule).
- Migrations run successfully against the **real production Supabase Postgres**
  (same `DATABASE_URL` as the Strapi backend, fresh Django-native tables —
  per the approved plan, no shared tables with Strapi).
- End-to-end verified via curl against a live server: register, login,
  authenticated `/api/me`, unauthenticated 401, wrong-password 400,
  duplicate-email 400 — all passed. Test user deleted from the database
  afterward (no leftover test data in production).

**Files touched:**
- `backend_django/manage.py`, `config/{settings/{base,local,production}.py,
  urls.py,wsgi.py,asgi.py}`, `.env`, `.gitignore`, `requirements.txt`
- `backend_django/apps/core/{pagination,mixins,exceptions,cache}.py`
- `backend_django/apps/accounts/{models,serializers,views,urls,
  authentication,permissions,admin}.py`, `apps/accounts/migrations/0001_initial.py`
- `backend_django/apps/integrations/circuit_breaker.py`
- `backend_django/apps/{marketplace,activity,academy}/*` — empty app
  skeletons only, fleshed out in later stages.

**Notes/deviations:**
- `djangorestframework-simplejwt`'s `JWTAuthentication.get_user()` doesn't
  expose `user_id_claim` as an instance attribute the way I first assumed —
  fixed by reading `api_settings.USER_ID_CLAIM` directly.
- `bcrypt` package had to be installed explicitly (not a transitive
  dependency of anything else) since it's listed first in `PASSWORD_HASHERS`.
- Access tokens are long-lived (30 days) with no refresh-token flow exposed
  to the frontend, matching how the frontend only ever stores one `jwt`
  string today (`src/lib/session.ts`) — revisit if the frontend cutover
  wants rotation later.

## Stage 2 — Core marketplace reads
**Status:** Done
**What's implemented:**
- `apps.marketplace` models, ported field-for-field from the 6 catalog
  schemas in `backend/src/api/{job,contest,course,product,brand,
  testimonial}/content-types/*/schema.json`: `Job`, `Contest`, `Course`,
  `Product`, `Brand`, `Testimonial`. Per the approved plan, Strapi's two
  repeatable components were promoted to real ordered tables: `Prize` (was
  `contest.prize`) and `Module`/`Lesson` (was `course.module`/`course.lesson`,
  with `unique_together(module, key)` enforced — Strapi's component table
  never enforced this).
- `apps.core.slugs.slugify`/`unique_slug` — exact port of
  `backend/src/utils/slugify.ts`'s slug generation + collision-suffix logic.
- DRF `ReadOnlyModelViewSet`s for all 6, registered on a `DefaultRouter` at
  `/api/{jobs,contests,courses,products,brands,testimonials}`, with
  `lookup_field="slug"` on the four that have one (Django needs no
  Strapi-style documentId-resolution trick — slug IS the lookup value).
- Computed fields, ported exactly from the 3 Strapi controllers: `postedAgo`
  (Job, via the same `timeAgo()` day/week/month bucketing), `daysLeft`/
  `prizePool`/`topPrize`/`winnerCount` (Contest, from its prizes), `lessonCount`
  (Course — list view counts lessons without serializing the full curriculum,
  detail view returns the full `modules`/`lessons` tree, matching Strapi's
  "populate id-only for find, full curriculum for findOne" split).
- Job visibility rule ported exactly: `status="draft"` jobs are excluded from
  list results and 404 on direct detail access for everyone except Admin role.
- `apps.core.mixins.CachedListMixin` — generic version of Strapi's
  `cached('jobs', JSON.stringify(ctx.query), 30, ...)` pattern, keyed by
  `request.get_full_path()` instead of a JSON-stringified query object (same
  effect: distinct cache entries per filter/page/search combination). Wired
  onto Job/Contest/Course (the three Strapi caches; Product/Brand/Testimonial
  weren't cached in Strapi either, so left uncached here too).
- Filtering via `django-filter` `FilterSet`s (`JobFilter`/`CourseFilter`) +
  DRF's `OrderingFilter`/`SearchFilter` — DRF-idiomatic query dialect per the
  confirmed decision (`?field=Craft`, `?search=welder`), not Strapi's bracket
  syntax.
- End-to-end verified against the real Supabase Postgres: seeded a published
  job, a draft job, a contest with 2 prizes, and a course with a module/2
  lessons; confirmed list hides the draft, detail 404s the draft, computed
  fields are correct (`daysLeft`, `prizePool=1500`, `topPrize=1000`,
  `winnerCount=2`, `lessonCount=2`), filtering/search work, and the cache
  measurably engages (509ms cold Supabase round trip -> 19ms warm hit on a
  repeated identical request). All test data deleted afterward.

**Files touched:**
- `backend_django/apps/marketplace/{models,serializers,views,filters,urls,
  admin}.py`, `apps/marketplace/migrations/0001_initial.py`
- `backend_django/apps/core/{slugs.py, mixins.py (added CachedListMixin)}`
- `backend_django/config/urls.py` (registered marketplace routes)
- `backend_django/requirements.txt` (refreshed)

**Notes/deviations:**
- `daysLeft` initially returned a float (Python's `//` operator) —fixed to
  `math.ceil(...)` matching Strapi's `Math.ceil`, returning a clean int.
- Local cache backend is still LocMemCache (no `UPSTASH_REDIS_URL` set yet),
  so the demonstrated cache speedup is process-local only — the pattern will
  carry over identically once Redis is configured for staging/production.

## Stage 3 — Marketplace writes + ActivityLog + Redis cache
**Status:** Done (built together with Stage 4 — apply/enter share the same
file-upload path Stage 4 implements, so splitting them into two passes would
have meant writing the action endpoints twice)
**What's implemented:**
- 5 write-side models added to `apps.marketplace`, ported 1:1 from
  `backend/src/api/{job-application,contest-entry,enrollment,saved-job,
  lesson-progress}/content-types/*/schema.json`: `JobApplication`,
  `ContestEntry`, `Enrollment`, `SavedJob`, `LessonProgress`. Each gets a real
  `unique_together` constraint Strapi only enforced at the controller level
  (one application/entry/enrollment/save per user per target; one progress
  row per user+course+lesson).
- `apps.activity.ActivityLog` + `log_activity()` — ported from
  `backend/src/utils/activity.ts`. The SSE broadcast half of the original
  (`strapi.eventHub.emit('tv.activity', ...)`) is deliberately deferred to
  Stage 12, which replaces the whole in-process-hub mechanism with Redis
  Pub/Sub anyway — building it twice would be wasted work.
- `JobViewSet.apply`/`.applicants`, `ContestViewSet.entries`/`.leaderboard`,
  `CourseViewSet.enroll` — DRF `@action` endpoints matching the exact paths
  in `backend/src/api/{job,contest,course}/routes/custom-*.ts`
  (`POST /jobs/:slug/apply`, `GET /jobs/:slug/applicants` (admin-only),
  `POST /contests/:slug/entries`, `GET /contests/:slug/leaderboard`,
  `POST /courses/:slug/enroll`), each porting the source controller's exact
  validation order (closed-job / deadline-passed checks before the
  already-applied conflict check, etc.).
- `SavedJobsView`/`UnsaveJobView` (`GET`/`POST /api/saved-jobs`,
  `DELETE /api/saved-jobs/:jobSlug`) and `LessonProgressView`/
  `MarkProgressView` (`GET /api/lesson-progresses`, `POST /api/progress`) —
  ported from `saved-job.ts`/`lesson-progress.ts`, including the
  lessonKey-must-exist-in-this-course validation `mark` does before creating
  a progress row.
- `MyApplicationsView`/`MyEntriesView`/`MyCoursesView`
  (`GET /api/me/{applications,entries,courses}`) — ported from
  `backend/src/api/me/controllers/me.ts`'s `applications`/`entries`/`courses`
  actions, including the progress-percentage calculation in `courses`.
- `apps.core.exceptions.Conflict` (409) — DRF has no built-in equivalent of
  Strapi's `ctx.conflict(...)`.
- `invalidate_scope("contests")` wired into the `entries` action (entry
  count changed, bypassing the cached queryset) — verified live: a contest's
  `entries` count updated immediately on the next read after entering.
- End-to-end verified against the real Supabase Postgres with two test users
  (one talent, one admin): apply (401 unauthenticated -> 201 success -> 409
  duplicate), apply-to-closed-job (400 with the correct message, not a
  generic fallback), applicants (403 for non-admin -> 200 for admin), enter
  contest (201 -> 409 duplicate, entries count bumped), enroll (201 -> 409
  duplicate), save/list/unsave a job, mark lesson progress (200 -> 400 for an
  unknown lessonKey), `/api/me/applications`/`entries`/`courses` (courses
  correctly computed 50% from 1-of-2 lessons completed). All test data
  (jobs/contests/courses/applications/entries/enrollments/activity
  logs/users) deleted afterward — FK cascades confirmed to clean up
  dependent rows correctly.

**Files touched:**
- `backend_django/apps/marketplace/{models,serializers,views,urls,admin}.py`,
  `apps/marketplace/migrations/0002_*.py`
- `backend_django/apps/activity/{models,utils,admin}.py`,
  `apps/activity/migrations/0001_initial.py`
- `backend_django/apps/core/exceptions.py` (added `Conflict`, fixed the
  exception handler — see Notes)
- `backend_django/requirements.txt` (refreshed)

**Notes/deviations:**
- Found and fixed a real bug in Stage 1's `envelope_exception_handler`: a
  plain-string `ValidationError("message")` comes back from DRF as a bare
  *list* (`["message"]`), not a dict with a `detail` key — the handler only
  checked the dict case, so these errors were silently replaced with the
  generic "Something went wrong." fallback. Now handles both shapes. This
  would have affected every plain-string `ValidationError` raise across all
  future stages had it not been caught here.
- `documentId` must never be listed in a serializer's `Meta.fields` —
  `DocumentIdMixin` injects it in `to_representation` after DRF's own
  rendering, so listing it in `fields` makes DRF validate it against the
  model's real fields and crash with `ImproperlyConfigured`. Hit this on
  `JobApplicationSerializer`/`ContestEntrySerializer`; the Stage 2
  serializers had it right by omission. Worth double-checking on every new
  `DocumentIdMixin` serializer going forward.

## Stage 4 — Cloudinary uploads
**Status:** Done (see Stage 3 — built together since apply/enter's file
upload is one code path)
**What's implemented:**
- `apps.integrations.cloudinary_client.upload_file()`/`delete_file()` — direct
  `cloudinary` Python SDK calls against the same Cloudinary account Strapi's
  `provider: 'cloudinary'` upload plugin already uses (reused credentials,
  no new account). `resource_type="auto"` matches Strapi's provider default,
  so images/PDFs/docs all upload correctly without per-type branching.
- Wired into `JobViewSet.apply` (`cv` field) and `ContestViewSet.entries`
  (`work` field): `JobApplication`/`ContestEntry` store `{cv,work}_url/name/
  size/public_id` directly (no separate generic media table — nothing else
  in this app needs one, unlike Strapi's plugin-wide media library).
- `_parse_apply_like_body()` helper in `apps/marketplace/views.py` — mirrors
  `src/lib/actions/applications.ts`'s `postApplyLike`: multipart with a JSON
  `data` field + a file field when a file is attached, plain JSON body
  otherwise. Verified both code paths.
- End-to-end verified: uploaded a real text file through
  `POST /jobs/:slug/apply` as multipart/form-data — confirmed it landed in
  the actual Cloudinary account at a real, fetchable `res.cloudinary.com`
  URL, and the returned `cv` JSON (`{url, name, size}`) matched.

**Files touched:**
- `backend_django/apps/integrations/cloudinary_client.py`
- `backend_django/apps/marketplace/views.py` (apply/entries actions)
- `backend_django/requirements.txt` (added `cloudinary`)

**Notes/deviations:**
- One small test file (`test-cv.txt`) was left in the Cloudinary account
  under the `job-applications/` folder from verification — harmless (a few
  bytes, not sensitive), but its `public_id` was lost when the test
  `JobApplication` row was deleted before remembering to call `delete_file()`
  on it. Not worth a special cleanup pass; flagging in case it's ever
  noticed in the Cloudinary dashboard.
- `CLOUDINARY_*` env vars aren't validated as present at startup — if unset,
  `upload_file()` will fail at call time with a Cloudinary SDK error rather
  than a clearer one. Acceptable for now since the real credentials are
  already in `.env`; revisit if a staging environment ever runs without them.

## Stage 5 — Admin dashboard endpoints
**Status:** Done
**What's implemented:**
- Discovered and closed a real gap while researching this stage: Stage 2 made
  Job/Contest/Course read-only, but the admin UI (`src/lib/actions/admin.ts`)
  actually does full CRUD on these through Strapi's core REST routes
  directly (no separate "admin" content-type for them) — confirmed by
  reading `backend/src/index.ts`'s `ADMIN_ACTIONS` permission list. Converted
  `JobViewSet`/`ContestViewSet`/`CourseViewSet` from `ReadOnlyModelViewSet`
  to full `ModelViewSet`, with `create`/`update`/`partial_update`/`destroy`
  gated to `IsAdminRole` via `get_permissions` (reads stay `AllowAny`).
- `JobWriteSerializer`/`ContestWriteSerializer`/`CourseWriteSerializer` —
  separate from the Stage 2 read serializers. Auto-generates `slug` on
  create when absent (via `apps.core.slugs.unique_slug`, matching
  `uniqueSlug`'s behavior in `backend/src/api/job/controllers/job.ts` for
  API-driven creates). `ContestWriteSerializer`/`CourseWriteSerializer`
  replace their nested `prizes`/`modules`+`lessons` rows wholesale on every
  create/update — matches Strapi's repeatable-component semantics, where the
  admin form always submits the full curriculum/prize list as JSON, not a
  diff.
- `apps.core.mixins.UnwrapDataMixin` — admin writes from
  `src/lib/actions/admin.ts`'s shared `writeEntity` helper always send
  `{ data: {...} }` (a Strapi-ism baked into that one shared function across
  every save action); unwrapping it server-side means that helper, and every
  call site that uses it, needs zero changes.
- `apps.core.mixins.PkForWriteMixin` — public reads use
  `lookup_field = "slug"` for pretty URLs, but admin writes
  (`writeEntity`/`deleteEntity`) always address rows by `documentId`
  (`/api/jobs/:documentId`), which is just the numeric PK here. This mixin
  routes only `update`/`partial_update`/`destroy` through a PK lookup,
  leaving `retrieve`/`list` on slug — directly mirrors Strapi's own
  `idOrDocumentIdWhere` dual-lookup pattern (`backend/src/utils/
  scoped-find.ts`), just split across two lookup fields instead of one
  either-or query.
- `JobApplicationStatusView`/`ContestEntryStatusView`
  (`PUT /api/{job-applications,contest-entries}/:id`) — admin-only,
  status/rank fields only. Matches the permission matrix exactly: Strapi
  grants `update` on these two content-types to Admin only, with no
  `create`/`delete` exposed via the core route at all (rows only ever
  originate from `apply`/`enter`), which is why these are intentionally
  PUT-only views, not full viewsets.
- `AdminDashboardStatsView`/`AdminDashboardActivityView`
  (`GET /api/admin-dashboard/{stats,activity}`) — ported from
  `backend/src/api/admin-dashboard/controllers/admin-dashboard.ts`, same
  90s cache TTL on `stats`, same 6-row limit on `activity`. The `stream`
  action (SSE) is deferred to Stage 12, which replaces the in-process
  eventHub it depended on with Redis Pub/Sub anyway.
- End-to-end verified against the real Supabase Postgres with an admin and a
  talent test user: job create (403 talent -> 201 admin, slug auto-generated)
  -> update by documentId -> delete by documentId -> confirmed gone by slug;
  contest create with 2 nested prizes -> update replacing them with a single
  different prize (confirmed old prizes gone, not merged); course create
  with a nested module+2 lessons -> confirmed full curriculum and
  `lessonCount` correct on read-back; job-application status update (403
  talent -> 200 admin); admin-dashboard stats (403 talent -> 200 admin with
  correct counts) and activity feed. All test data deleted afterward.

**Files touched:**
- `backend_django/apps/marketplace/{views,serializers,urls,
  admin_dashboard_views.py}` (new file)
- `backend_django/apps/core/mixins.py` (added `UnwrapDataMixin`,
  `PkForWriteMixin`)
- `backend_django/requirements.txt` (refreshed)

**Notes/deviations:**
- Scope check: confirmed via `grep` that the frontend's admin UI has no
  create/update/delete pages for Product/Brand/Testimonial (only Strapi's
  own CMS panel managed those, which Django has no equivalent of) — so no
  REST write endpoints were built for them. Django's built-in admin site
  (already wired in Stage 2's `admin.py` registrations) covers that need
  instead; revisit only if the frontend ever grows admin pages for these.
- The PK-vs-slug lookup split (`PkForWriteMixin`) was not anticipated in the
  original plan — found only by testing the actual admin write flow end to
  end and hitting a 404, then tracing it back to `writeEntity`'s use of
  `documentId` instead of `slug`. Worth remembering for Stage 6+: any
  Academy admin viewset with a slug-like public lookup will need the same
  treatment if its admin writes also address rows by id.

## Stage 6 — Academy catalog (Category/Course/Cohort/Material)
**Status:** Done
**What's implemented:**
- New `apps.academy` app. Important scoping discovery made before writing any
  code: the Academy frontend was **never actually wired to Strapi** — it ran
  entirely off mocked `localStorage` state (confirmed in
  `ACADEMY_BACKEND_SPEC.md`). Unlike every marketplace stage, there is no
  live frontend contract to preserve here, so Academy API paths/shapes in
  this and all following Academy stages are designed clean/DRF-idiomatic
  from scratch — only the underlying *business logic* (progression rules,
  facilitator scoping, anonymity) is ported faithfully from the existing
  Strapi controllers, since that logic is the part the spec actually
  validates.
- Models ported field-for-field from `backend/src/api/{academy-category,
  academy-course,academy-cohort,academy-material}/content-types/*/
  schema.json`: `AcademyCategory`, `AcademyCourse`, `AcademyCohort`,
  `AcademyMaterial`. Also added `AcademyCertificate` now (a Stage 9 model on
  paper) because Stage 7's completion logic creates rows in it — see Stage 7
  notes.
- `AcademyCategoryViewSet`/`AcademyCourseViewSet` — public read, admin-only
  write, same auto-slug-on-create pattern as the marketplace catalog
  (`apps.core.slugs.unique_slug`).
- `AcademyCourseViewSet.curriculum` (`GET /academy-courses/:slug/curriculum`)
  — ported from `academy-course.ts`'s `curriculum` action: weeks -> days ->
  `hasMaterial` flag only, never the material content itself.
- `AcademyCohortViewSet` — **no public access at all**, core CRUD is
  admin-only (confirmed via `ADMIN_ACTIONS` in `backend/src/index.ts`:
  facilitators get no raw find/findOne, only scoped custom actions):
  - `my-cohorts` (facilitator-only, filtered to their own)
  - `rollout-next-week` (admin or the owning facilitator)
  - `threshold` GET/PUT (admin or the owning facilitator; `min_completion`/
    `check_weeks`)
  All three enforce facilitator ownership server-side (cross-facilitator
  access to another's cohort returns 404, not 403 — matches the original's
  "pretend it doesn't exist" framing for someone else's data).
- `AcademyMaterialView` (`GET/PUT/DELETE /academy-courses/:course_id/days/
  :day/material`) — ported `canAccessCourseMaterial`'s three-way check
  (admin always; facilitator only if they run a cohort on this course;
  student only if actively enrolled in a cohort on this course, `removed=
  False`). Unauthored material returns `{data: null}`, never 404 — the spec
  is explicit that the client decides whether to show a placeholder. Mux
  fields are never serialized (mirrors Strapi's `private: true`); Mux
  upload/playback-token actions are deferred to Stage 10.
- End-to-end verified against the real Supabase Postgres with admin/
  facilitator/student test users and a second facilitator (to prove
  cross-facilitator denial): category+course creation, curriculum outline
  before/after authoring material, cohort creation (403 facilitator -> 201
  admin), `my-cohorts` scoping, `threshold` GET/PUT (200 owning facilitator
  -> 404 different facilitator), material PUT by facilitator -> GET by
  enrolled student (access granted) -> curriculum reflecting `hasMaterial:
  true`. All test data deleted afterward.

**Files touched:**
- `backend_django/apps/academy/{models,serializers,views,urls,admin}.py`,
  `apps/academy/migrations/0001_initial.py`
- `backend_django/config/urls.py` (registered academy routes)

**Notes/deviations:**
- `AcademyCohort.check_weeks`'s model default was initially a bare empty
  list — fixed to `[4, 8]` (a separate small migration) to match Strapi's
  schema default; caught by noticing the read-back didn't match what was
  just written.

## Stage 7 — Academy enrollment + progression engine
**Status:** Done
**What's implemented:**
- `apps.academy.progression` — line-for-line port of
  `backend/src/utils/academy-progression.ts` (`week_of`, `is_available`,
  `normalize`, `is_caught_up`, `pace_completion`, `chunk`), using a
  `@dataclass ProgressionState` in place of the TS type.
- `apps.academy.completion.maybe_complete_enrollment` — port of
  `backend/src/utils/academy-completion.ts`: marks an enrollment `Completed`
  once `current_day >= days_total`, and issues an `AcademyCertificate` (with
  an auto-generated unique `verification_code`, matching the lifecycle hook
  in `academy-certificate/content-types/.../lifecycles.ts`) if the course
  awards one and none exists yet. This is why `AcademyCertificate` shipped a
  stage early, in Stage 6.
- `apps.academy.services.rollout_to_week` — port of the
  `academy-cohort` service's `rolloutToWeek`: bumps `released_week`
  (clamped to `weeks_total`), re-normalizes every non-removed enrollment's
  `current_day` against the new released week, and runs completion-checking
  on each. Shared by both the manual `rollout-next-week` action (Stage 6)
  and the scheduled job below — both code paths apply identical rules, by
  construction (one function, two callers).
- `apps.academy.management.commands.rollout_academy_cohorts` — port of
  `backend/config/cron-tasks.ts`'s `academy-weekly-rollout` daily task,
  as a Django management command (`python manage.py
  rollout_academy_cohorts`) rather than a Celery beat task — per the plan,
  to be invoked by a DigitalOcean App Platform Scheduled Job on the same
  `0 1 * * *` cron expression, since there's no other recurring-job need
  yet that would justify running a broker/worker.
- `AcademyEnrollmentViewSet` — find/findOne/delete only (no create/update
  via the core route; enrollment-creation itself ships in Stage 8 alongside
  submissions). Scoped: students see only their own rows, admin sees all
  (`loadVisibleEnrollment`/`scopedFind` in the original). `destroy` ported
  the original's data-hygiene guard: refuses to delete an enrollment that
  has a certificate or (once Stage 8 ships) submissions attached.
  `request-early-access` action (student, own-enrollment-only).
- End-to-end verified: backdated a test cohort's `start_date` by ~20 days
  and reset `released_week` to 1, ran the management command, confirmed it
  computed `ceil(20/7) = 3` and advanced `released_week` to 3, logged a
  `rollout` activity row, and was a no-op (idempotent) on a second run with
  no date change. Verified enrollment listing scoping (student sees own,
  admin sees all) and `request-early-access` end-to-end. All test data
  deleted afterward.

**Files touched:**
- `backend_django/apps/academy/{progression,completion,services}.py`
- `backend_django/apps/academy/management/commands/rollout_academy_cohorts.py`
- `backend_django/apps/academy/{models,views}.py` (AcademyEnrollment +
  AcademyCertificate, request-early-access action)

**Notes/deviations:**
- `submitTask`/`listSubmissions` (the other two `academy-enrollment.ts`
  actions) are intentionally **not** built yet — both require
  `AcademySubmission`, which is Stage 8's model. Building them now would
  have meant touching this same controller twice. `AcademyEnrollmentViewSet
  .destroy`'s submission check (`hasattr(enrollment, "submissions")`) is
  written defensively so it activates automatically once Stage 8 adds that
  related model — no revisit needed there.
- `grantEarlyAccess` and `team` (also in the original `academy-enrollment.ts`)
  are deferred to Stage 9 (facilitator roster tools / team matching) — they
  depend on facilitator-initiated flows and `AcademyTeam`, neither of which
  exist yet.

## Stage 8 — Academy submissions + judging + anonymity
**Status:** Done
**What's implemented:**
- `AcademySubmission`/`AcademyJudgment` models, ported field-for-field from
  `backend/src/api/{academy-submission,academy-judgment}/content-types/*/
  schema.json`. `course_title`/`anon_handle` are denormalized onto the
  submission specifically so the judge queue never needs to populate
  `enrollment` (the relation chain back to user/cohort).
- `apps.academy.anon_handle.generate_anon_handle` — port of
  `backend/src/utils/anon-handle.ts`'s "Entry A12"-style handle generator.
- `AcademyEnrollmentViewSet.submit_task`/`.submissions` — the two
  enrollment actions deferred from Stage 7 because they needed this stage's
  `AcademySubmission` model. `submit_task` rejects any day other than the
  enrollment's actual `current_day` (a student can only submit *today's*
  task), advances `current_day`/`submitted_days` via the same
  `progression.normalize` used by rollout, and calls
  `maybe_complete_enrollment` (so a submission that crosses the finish line
  issues a certificate, same as a rollout would). Also converted
  `AcademyEnrollmentViewSet` from read-only to allow `create` — admin-only,
  since there is no student self-enroll flow for the Academy (confirmed:
  `ACADEMY_STUDENT_ACTIONS` has no `academy-enrollment.create`).
- `JudgeQueueView`/`RateSubmissionView` (`GET /academy-judging/queue`,
  `POST /academy-judging/:id/rate`) — judge-role-only. **Anonymity is a hard
  rule** (ACADEMY_BACKEND_SPEC.md §7): `JudgeQueueItemSerializer` is a plain
  `Serializer` over a hand-built dict (not a `ModelSerializer` over the
  `AcademySubmission` instance), so there is no `instance.enrollment` ever
  reachable from it even by accident — the queue query itself only ever
  selects `id/day/week/task/course_title/url/note/submitted_at/anon_handle`,
  never touching the `enrollment` FK. `rate` is single-judge-rates-once
  (409 on a second judge attempting the same submission, 409 if already
  rated by anyone) and never names the judge in the activity feed, even to
  admins ("A judge rated...", matching the original mock data's phrasing).
- End-to-end verified: an automated grep of the live judge-queue JSON
  response confirmed no `enrollment`/`cohort`/`user` key anywhere in it;
  rated a real submission and confirmed the second rating attempt 409'd;
  confirmed a non-judge role gets 403 on the queue. All test data deleted
  afterward.

**Files touched:**
- `backend_django/apps/academy/{models,serializers,views,urls,admin}.py`
- `backend_django/apps/academy/anon_handle.py` (new)
- `apps/academy/migrations/0003_*.py` (also carries Stage 9/10's model
  additions — generated together)

**Notes/deviations:**
- None — this stage's scope matched the plan exactly.

## Stage 9 — Certificates + facilitator roster tools
**Status:** Done
**What's implemented:**
- `AcademyTeam`/`AcademyLiveSession`/`AcademyRosterRequest` models, ported
  field-for-field from their respective Strapi schemas. `AcademyCertificate`
  was already built in Stage 6/7 (pulled forward for the completion logic);
  this stage adds its only remaining piece, the public verify endpoint.
- `CertificateVerifyView` (`GET /academy-certificates/verify/:code`) —
  public, returns only the four snapshot fields (student name/course
  title/cohort name/issued-at), never the underlying enrollment.
- A large block of facilitator-or-admin actions added to
  `AcademyCohortViewSet`: `roster`, `student_profile` (nested
  `students/:uid` regex path), `top_rated`, `shortlist_toggle`,
  `remove_student`/`restore_student`, `transfer_student`/`transfer_bulk`,
  `remove_bulk`, `early_access_requests`, `roster_request_create`/
  `roster_requests_find` (GET/POST on the same `roster-requests` path via
  DRF's `.mapping` decorator), `sessions_find`/`sessions_create` (same
  pattern), `teams_match`/`teams_create`/`teams_clear`/`teams_get`. All
  enforce facilitator-ownership via `_assert_facilitator_owns` (404, not
  403, for a different facilitator's cohort — "pretend it doesn't exist").
  `sessions_find` is the one exception: it also allows an enrolled student
  to view their cohort's sessions, via a new `_assert_cohort_visible` helper
  (port of `assertCohortVisible` — admin always, facilitator-if-owns,
  student-if-non-removed-enrollment).
- `AcademyCohortViewSet.destroy` — port of `academy-cohort.ts`'s `delete`:
  refuses to delete while active (non-removed) enrollments exist; cascades
  `AcademyLiveSession`/`AcademyTeam` rows (meaningless once the cohort is
  gone) while leaving enrollments untouched.
- `AcademyTeamViewSet` (`rename_team`/`destroy`/`add_member`/`remove_member`,
  keyed by team id, not cohort id) — deliberately named distinctly from the
  default core update/delete actions, same reasoning as the original
  `academy-team.ts` comment: granting a permission for these action names
  must only ever unlock the custom routes that carry the ownership check,
  never open a second, unguarded path to the same effect.
- `RosterRequestStatusView` (`PUT /academy-roster-requests/:id/status`,
  admin-only, status must be `Fulfilled`/`Dismissed`) and
  `apps.academy.roster_request.shape_roster_request` — a direct port of
  `backend/src/utils/roster-request.ts`'s `shapeRosterRequest`, shared by
  the cohort-scoped create/list actions and this admin endpoint so the
  response shape can't drift between them (same reasoning Strapi's own util
  module had).
- End-to-end verified with two facilitators owning separate cohorts of the
  same course: roster/student_profile/top_rated (with a real judged
  submission feeding the average), shortlist toggle, remove/restore,
  cross-cohort transfer (re-derives `current_day` against the *target*
  cohort's `released_week`, confirmed it reset to day 1 when transferred
  into a cohort still at `released_week=0`), sessions (student-visible,
  cross-facilitator denied), teams (match/create/conflict-detection/rename/
  remove-member/clear via the separate `AcademyTeamViewSet`), roster
  requests (create/list/admin-status-update, non-admin denied), forced an
  enrollment to completion to confirm certificate issuance and tested the
  public verify endpoint (valid code, 404 on a bogus one), and confirmed
  `AcademyEnrollmentViewSet.destroy` now blocks deletion once a certificate
  exists (the branch that couldn't be exercised back in Stage 7). All test
  data deleted afterward.

**Files touched:**
- `backend_django/apps/academy/{models,serializers,views,urls,admin}.py`
- `backend_django/apps/academy/roster_request.py` (new)

**Notes/deviations:**
- `sessions_create` has no facilitator-ownership check in the original
  controller (only `sessions_find` calls `assertCohortVisible`) — likely an
  oversight in the source, since the route-permission grant alone wouldn't
  stop one facilitator from creating a session on another's cohort if they
  guessed the id. Since Academy has no live frontend contract to preserve,
  this was a deliberate, documented improvement: `sessions_create` now also
  calls `_assert_facilitator_owns`.

## Stage 10 — Mux integration
**Status:** Done
**What's implemented:**
- `apps/integrations/mux_client.py` — port of `backend/src/utils/mux.ts`,
  implemented directly against Mux's REST API + manual JWT
  signing/webhook-signature verification rather than the Node SDK's helper
  methods (no single first-party Python SDK covers direct-upload creation,
  signed-playback-token signing, and webhook verification together).
  `create_direct_upload` always requests a `signed` (never `public`)
  playback policy. `sign_playback_token` signs an RS256 JWT (`sub`=
  playback id, `aud`="v", 4h expiry) using the same Mux signing key Strapi
  already has (base64-encoded PEM in `MUX_SIGNING_SECRET_KEY`, decoded at
  point of use). `unwrap_webhook_event` verifies Mux's
  `Mux-Signature: t=...,v1=...` HMAC-SHA256 header (same scheme Stripe
  uses) before parsing the payload.
- `AcademyMaterialMuxUploadUrlView`/`AcademyMaterialPlaybackTokenView`
  (`POST .../mux-upload-url`, `GET .../playback-token`) — same
  write/read access gates as `AcademyMaterialView.put`/`.get`
  (`_can_access_course_material` + admin/facilitator role check for the
  upload URL).
- `MuxWebhookView` (`POST /webhooks/mux`, public — Mux-signature-verified,
  not session-authenticated, mounted at top-level in `config/urls.py`
  rather than under `/api/`, matching the original's bare `/webhooks/mux`
  path) — on `video.asset.ready`, writes `mux_asset_id`/`mux_playback_id`
  onto the `AcademyMaterial` row matched by `mux_upload_id`.
- End-to-end verified against Mux's real API (the same account/credentials
  Strapi already uses): created a real direct-upload URL, confirmed the
  returned `uploadId` persisted onto the material row, confirmed
  `playback-token` correctly 404s before an asset exists, simulated a
  signed `video.asset.ready` webhook (via a temporarily monkeypatched
  webhook secret, since the real one isn't provisioned in either backend's
  `.env` yet) and confirmed it populated `mux_playback_id`, then confirmed
  `playback-token` now returns a real signed RS256 JWT. Also confirmed
  role-gating (student denied the upload-url action) and webhook signature
  rejection (missing header passes through cleanly; a present-but-bogus
  header was initially an unhandled 500 — see deviation below, now a clean
  401).

**Files touched:**
- `backend_django/apps/integrations/mux_client.py` (new)
- `backend_django/apps/academy/views.py` (Mux views), `apps/academy/urls.py`
- `backend_django/config/{settings/base.py,urls.py}` (`ACADEMY_FRONTEND_ORIGIN`
  setting, top-level `/webhooks/mux` route)
- `backend_django/requirements.txt` (`requests`, `cryptography`)

**Notes/deviations:**
- Bug caught during testing: `unwrap_webhook_event` crashed with an
  unhandled `AttributeError` (`NoneType.encode()`) when a request carried a
  well-formed-looking `Mux-Signature` header but `MUX_WEBHOOK_SECRET` was
  unset (true for both backends right now — the secret was never
  provisioned). Fixed by raising the same clean `ValueError` (-> 401) the
  malformed-header path already used, checked before ever touching the
  secret. A random placeholder `MUX_WEBHOOK_SECRET` has since been added to
  `backend_django/.env` so the setting is never unset — but it is **not**
  the real Mux-issued value: Mux only generates that secret once a webhook
  endpoint is registered against a reachable URL in their dashboard (no
  public API for webhook management), which doesn't exist until Stage 15's
  deploy. The placeholder must be swapped for the real one at cutover, or
  the webhook will verify signatures against the wrong secret and reject
  every real Mux event.
- No first-party Mux Python SDK was used (see "What's implemented" above)
  — `mux-python`, the OpenAPI-generated package, doesn't include JWT
  playback-token signing or webhook verification, so using it would have
  meant mixing it with manual PyJWT/HMAC code anyway. Went fully manual
  instead for one consistent implementation.

## Stage 11 — Academy admin dashboard
**Status:** Done
**What's implemented:**
- `apps/academy/admin_dashboard_views.py` — port of `backend/src/api/
  academy-admin/controllers/academy-admin.ts`'s 6 plain endpoints (the
  7th, `stream`, doesn't exist on this controller — that's Stage 12's
  `AdminDashboardStreamView`, on the *marketplace* admin-dashboard
  controller it actually lives on). All admin-only, mounted at
  `academy-admin/*` (not `admin-dashboard/*`, which Stage 5 already claimed
  for the marketplace dashboard — same naming convention as every other
  Academy-prefixed route).
  - `overview` — same 90s `cached()` pattern as Stage 5's
    `AdminDashboardStatsView`, no invalidation hook (matches the original,
    which also has none — confirmed via a deliberate test: seeded data
    right after a request, the next request still returned stale counts
    until the TTL lapsed).
  - `top_rated` — walks every `AcademyJudgment`, averages per student
    across all their judged submissions, top 10.
  - `activity` — `ActivityLog` filtered to the 6 Academy-specific
    `kind`s, distinct from Stage 5's unfiltered admin activity feed.
  - `users` — name-searchable picker across the 4 Academy roles (Student/
    Facilitator/Judge/Admin only — deliberately excludes Talent/Employer).
  - `create_user` — always lands the account as Student (promotion is a
    separate explicit step, never implicit); reuses `User.objects.
    create_user` so the password gets hashed the same way `/auth/register`
    does, mirroring the original's "go through the plugin's own user
    service" comment.
  - `update_user_role` — promotes/demotes among the 4 Academy roles.
  - `roster_requests` — the admin-wide (not cohort-scoped) listing,
    reusing `shape_roster_request` from Stage 9 so the shape can't drift
    between the cohort-scoped and admin-wide views.
- End-to-end verified: overview/top-rated/activity, role-filtered and
  name-searched user search, duplicate-email/username rejection on create,
  role promotion reflected in a follow-up search, non-admin denied on
  create, and the admin-wide roster-requests listing populated from a
  seeded request. All test data deleted afterward.

**Files touched:**
- `backend_django/apps/academy/admin_dashboard_views.py` (new)
- `backend_django/apps/academy/urls.py`

**Notes/deviations:**
- None — matched the plan and the original controller's scope exactly.

## Stage 12 — SSE realtime (Redis Pub/Sub)
**Status:** Done
**What's implemented:**
- `apps/integrations/pubsub.py` — `publish(channel, payload)`/
  `subscribe(channel)` using a raw `redis-py` client (not django-redis's
  cache wrapper, which has no Pub/Sub concept) against the same
  `UPSTASH_REDIS_URL` the cache layer uses. Degrades to a no-op publisher
  and a generator that just yields `None` on a timer when Redis isn't
  configured — same "never let this be a hard requirement" rule
  `apps/core/cache.py` follows; an SSE connection without Redis still
  serves `connected` + heartbeats forever, it just never gets a real
  event.
- `apps/core/sse.py` — shared `sse_stream()` (interleaves real messages
  with a 20s heartbeat, matching the originals' `setInterval`) and
  `sse_response()` (the `StreamingHttpResponse` + headers). Built on plain
  `django.views.View`, not DRF's `APIView` — DRF's response-finalization
  pipeline assumes a DRF `Response` object, not a streaming body.
- `JobStreamView` (`GET /api/job-stream`, public) and
  `AdminDashboardStreamView` (`GET /api/admin-dashboard/stream`,
  admin-only) — exact path matches required here because, unlike Academy,
  **the marketplace frontend is actually live-wired to these**: confirmed
  via `src/components/cards/LiveJobList.tsx`/`LiveActivityFeed.tsx` and
  their proxy routes, which hit `${STRAPI_URL}/api/job-stream` and
  `${STRAPI_URL}/api/admin-dashboard/stream` literally — these paths could
  not be redesigned the way Academy's were.
  `AdminDashboardStreamView`'s admin gate is done by hand (simplejwt's
  `CachedJWTAuthentication.authenticate()` only needs `request.META`,
  which a plain Django `HttpRequest` has too, so it's reusable as-is
  without DRF's permission-class machinery).
- `apps.activity.utils.log_activity` now publishes to `tv:activity` after
  persisting the row (replaces `strapi.eventHub.emit('tv.activity', ...)`
  — the broadcast half deferred since Stage 3).
- `JobViewSet.perform_create` (marketplace) now publishes to
  `tv:job:created` for any non-draft job, mirroring job.ts's create
  override exactly (draft jobs never broadcast, matching the public
  find/findOne filtering already in place since Stage 2).
- End-to-end verified against a real local Redis instance (Upstash wasn't
  reachable for this test session, so `UPSTASH_REDIS_URL` was overridden
  on the command line only — `.env` itself was left untouched): curled
  `/api/job-stream`, published a `tv:job:created` event from a separate
  shell, and captured the exact SSE frame on the open connection; repeated
  the same for `/api/admin-dashboard/stream` via a real `log_activity()`
  call, and separately confirmed the stream 403s with no/wrong-role auth.

**Files touched:**
- `backend_django/apps/integrations/pubsub.py` (new)
- `backend_django/apps/core/sse.py` (new)
- `backend_django/apps/marketplace/{views,admin_dashboard_views,urls}.py`
- `backend_django/apps/activity/utils.py`
- `backend_django/config/settings/base.py` (`UPSTASH_REDIS_URL` exposed as
  a proper settings attribute, not just a local var used to build `CACHES`)

**Notes/deviations:**
- Bug caught during testing: `StreamingHttpResponse` setting an explicit
  `Connection: keep-alive` header crashed Django's dev server with
  `AssertionError: Hop-by-hop header ... not allowed` (wsgiref's WSGI
  handler rejects it outright). Dropped the header entirely — it's
  hop-by-hop and managed by the WSGI server itself; SSE works identically
  without an app-set `Connection` header, and this avoids a difference
  between the dev server and gunicorn in production silently going
  untested.

## Stage 13 — ETL script
**Status:** Done (built + dry-run validated; the real committing run is
Stage 15's job, not this one — see Notes)
**What's implemented:**
- `python manage.py etl_from_strapi [--dry-run]` — reads Strapi's existing
  tables with raw SQL against `django.db.connection` (same DB connection
  Django already has open to the shared Supabase project — no second
  credential), writes through the Django ORM so model
  validation/constraints apply.
- Execution order respects FK dependencies throughout: Users -> Brand/
  Testimonial/Product/Job/Contest+Prize/Course+Module+Lesson ->
  JobApplication/ContestEntry/Enrollment/LessonProgress/SavedJob ->
  ActivityLog -> AcademyCategory/AcademyCourse/AcademyMaterial -> (the
  entire Academy cohort-rooted subtree, rebuilt as one unit) ->
  AcademySubmission -> AcademyJudgment -> AcademyTeam/LiveSession/
  RosterRequest/Certificate.
- Idempotency strategy, decided per content-type rather than uniformly
  (matches the plan's "in-memory map, no persisted source-id column"
  design):
  - Has a real natural key on the Django side (`User.email`, every
    catalog `*.slug`, `AcademyMaterial(course,day)`,
    `AcademySubmission.anon_handle`, the five Stage-3 `unique_together`
    ownership pairs, `AcademyJudgment(submission,judge)`,
    `AcademyCertificate.enrollment`) -> `update_or_create`. Safe to
    re-run any number of times.
  - No natural key + no dependents (`Brand`, `Testimonial`) -> wipe-all-
    and-recreate every run; trivially as correct as an upsert at this
    volume with nothing pointing at them by FK.
  - Repeatable components promoted to child tables (`Contest.prizes`,
    `Course.modules`/`.lessons`) -> wholesale delete-and-recreate per
    parent on each run — the exact same semantics the Stage 2/3 write
    serializers already use for these, so the ETL doesn't introduce a
    second, different convention for "replace a repeatable component."
  - The entire Academy cohort-rooted subtree (`AcademyCohort` and
    everything that cascades from it — Enrollment/Submission/Judgment/
    Team/LiveSession/RosterRequest/Certificate) has no natural key on
    `AcademyCohort` itself, so the whole subtree is wiped
    (`AcademyCohort.objects.all().delete()`, cascading) and rebuilt from
    source every run. `AcademyCategory`/`AcademyCourse`/`AcademyMaterial`
    sit *outside* this subtree (`AcademyMaterial` FKs to `AcademyCourse`,
    not `AcademyCohort`) and keep their own natural-key upserts —
    unaffected by a cohort rebuild.
- `parse_json()` — every `jsonb` column read through a raw
  `connection.cursor()` comes back as the literal JSON **text**, not a
  parsed Python object (Django's `JSONField.from_db_value` conversion
  only fires through the ORM's query compiler, never for a plain raw
  cursor fetch) — confirmed by directly inspecting a fetched value's
  `type()`. Every jsonb-sourced field (`responsibilities`, `requirements`,
  `rules`, `outcomes`, `details`, `sizes`, `docs`, `submitted_days`,
  `early_weeks`, `check_weeks`) is parsed by hand before use. This was
  caught and fixed *before* it could have silently dropped every list/
  array field in the migrated data — the dry-run's row counts looked
  identical with or without the fix, only the field *contents* would have
  differed, so this specifically needed direct inspection to catch, not
  just a count-based check.
- `normalize_string_list()` — port of `src/lib/data.ts`'s
  `normalizeStringList`, applied to every plain string-list field. A
  no-op for this dataset (every sample inspected during development was
  already a clean string list, no legacy rich-text "blocks" shape found),
  kept since the ETL only gets one real run before cutover and the
  defensive handling is cheap insurance.
- `_safe_row()` — real Strapi data isn't guaranteed to satisfy every
  constraint Django's stricter schema adds (caught live: a `courses` row
  with `weeks = -2`, violating a CHECK constraint Strapi's own schema
  never enforced). Postgres aborts the *entire* transaction on any
  statement error, so one bad row crashing the whole ETL was the first
  failure mode hit running the dry-run for real. Fixed by giving every
  per-row write its own SAVEPOINT (a nested `atomic()` block): a failed
  row rolls back only itself and gets logged as skipped, the run
  continues. A `FAILED` sentinel object (distinct from a legitimate
  `None` return) tracks success/failure through this without the
  ambiguity a bare truthiness check would have (a first draft of this
  used `if result:` / `bool(result)`, which is wrong the moment a
  successful write can legitimately return `None` or a falsy value —
  caught and fixed before it could silently miscount).
- Settings fix discovered while building the User migration:
  `PASSWORD_HASHERS` only listed `BCryptSHA256PasswordHasher` (which
  pre-hashes with SHA256 before bcrypt — incompatible with a raw bcrypt
  hash copied in as-is). Added plain `BCryptPasswordHasher` to the list
  (second, not first, so *new* passwords still encode with the SHA256
  variant) so Strapi's existing bcryptjs hashes (confirmed bcrypt format
  via length/substring check, without ever reading actual hash bytes)
  verify correctly after migration — this is what makes "no forced
  password reset" in the plan's ETL section actually true, as opposed to
  just documented intent.
- Dry-run executed directly against the real shared Supabase database
  (both Strapi's tables and Django's coexist there already — no separate
  "disposable copy" exists or is needed, since `--dry-run` wraps the
  whole run in one transaction and raises a sentinel exception at the end
  to force a rollback, so every write path is genuinely exercised with
  zero persisted side effects). Final counts: 26/33 users migrated (7
  skipped — 6 rows with no email at all, 1 real test account
  `video-url-test@example.com` stuck on Strapi's default `authenticated`
  system role, neither maps to a domain account); 1 of 2 courses skipped
  (the bad `weeks=-2` row, confirmed by name — `kk`/`sjjaa` — to be
  test/garbage data, not real catalog content); 2 roster requests skipped
  (their cohort link in Strapi is itself `NULL` — an orphaned/incomplete
  source row, not an ETL bug); every other content type's count matched
  the real row count in Strapi's tables exactly. Every one of these
  exceptions was individually traced back to a genuine data-quality
  property of the *source* data, not a bug in the script.

**Files touched:**
- `backend_django/apps/core/management/{__init__.py,commands/__init__.py,
  commands/etl_from_strapi.py}` (new)
- `backend_django/config/settings/base.py` (`PASSWORD_HASHERS` fix)

**Notes/deviations:**
- The real, committing run (`etl_from_strapi` without `--dry-run`) was
  deliberately **not** executed against production in this session — the
  build-order plan explicitly separates "ETL script: build, dry-run,
  validate" (this stage) from "deploy to DO App Platform, run ETL against
  production Supabase, verify, cutover" (Stage 15). Running the real
  commit now would pre-empt that stage and leave migrated-but-uncertain
  data sitting in the new tables for a long stretch before cutover
  actually happens, while Strapi keeps being the live source of truth and
  keeps changing underneath it. The dry-run already exercises 100% of
  the real write code path (same functions, same transaction machinery,
  same per-row error handling) and rolls back cleanly, which is what
  "build, dry-run, validate" asks for.
- Brand/Testimonial have no natural key and no dependents in our schema
  (no slug, nothing else FKs to them) — used wipe-and-recreate rather than
  a guessed soft key (e.g. matching on `name`), since guessing wrong would
  either silently duplicate or silently overwrite unrelated rows depending
  on luck, whereas wipe-and-recreate is unambiguously correct at this
  volume.
- File uploads (CV/work-sample attachments on `JobApplication`/
  `ContestEntry`) were not part of this run's scope to verify end-to-end —
  Strapi's `files` table is currently empty (0 rows) in the live data, so
  there's nothing to migrate yet. If real uploads exist by the time Stage
  15 runs the real ETL, `files`/`files_related_mph` will need a dedicated
  migration step (re-upload to Cloudinary or copy the existing provider
  URLs directly — undecided, low risk given current emptiness) added
  before that run.

**Update (2026-06-29):** the real (non-dry-run) `etl_from_strapi` run was
executed against production — ahead of Stage 15 — at the user's explicit,
confirmed request, specifically to unblock manual end-to-end testing of
the whole rewrite before deployment. Counts matched the dry-run exactly
(26 users, 1 brand, 1 testimonial, 1 product, 4 jobs, 2 contests + 7
prizes, 1 course + 2 modules + 4 lessons, 58 activity-log rows, 5 academy
categories, 19 academy courses, 3 academy materials, 3 academy cohorts,
17 academy enrollments, 10 submissions, 5 judgments, 9 teams, 6 live
sessions; 0 job applications/contest entries/enrollments/lesson
progress/saved jobs/roster requests/certificates — all genuinely absent
or orphaned in the source data, not script bugs, per the dry-run's
analysis above). This only wrote into Django's own (previously empty)
tables — Strapi's original tables were not touched or modified. Re-running
`etl_from_strapi` again before Stage 15's actual cutover is still
expected and safe given the idempotency design documented above (natural-
key upserts where Django has one; full wipe-and-rebuild for the
no-natural-key Academy cohort subtree and Brand/Testimonial) — this run
does not change Stage 15's remaining scope (deploy + final
pre-cutover re-run + verify + flip the env var), it just means Django's
tables are no longer empty during the deploy/testing window.

## Stage 14 — Frontend query-building update
**Status:** Done
**What's implemented:**
- Every `getXxx()` in `src/lib/data.ts` that previously built Strapi's
  nested bracket shape (`{ filters: { field: { $eq } }, sort, pagination:
  { page, pageSize } }`) now builds a flat object instead
  (`{ field, page, page_size }`), matching DRF's idiomatic flat query
  params — `getJobs`, `getContests`, `getCourses`, `getProducts`,
  `getBrands`, `getCourseLessonProgress`, `getSavedJobSlugs`.
- `src/lib/strapi.ts`'s `toQueryString`/`appendQueryParam` needed **zero**
  changes — it's already a generic flat-object-to-querystring serializer;
  the bracket syntax only ever appeared because `data.ts` was feeding it
  *nested* objects. Feeding it flat params produces clean
  `?field=Digital&page=1&page_size=12` output for free, confirmed with a
  standalone test before touching any call site.
- Param-name mapping confirmed against the actual Django viewsets rather
  than assumed: `page`/`page_size` (`StrapiStylePagination`), `search`
  (DRF's `SearchFilter` default param, replacing Strapi's
  `$containsi`/`$or` text search), `ordering` (DRF's `OrderingFilter`
  default param, replacing `sort: "field:asc/desc", e.g. `ordering=-price`
  for the shop's price-desc sort, `ordering=deadline` for the contests
  list, `ordering=name` for brands — Contest/Brand both needed this
  explicitly since their model's default ordering is `-created_at`, which
  doesn't match what the frontend actually needs there), and each
  filterset's exact field names (`field`, `level`, `type`, `locationType`,
  `delivery`, `kind`, `category`, `condition`, `kind`, `featured`).
- Price-band filtering (`PriceBand`: under-50k/50k-250k/250k-1m/1m-plus)
  had no DRF equivalent yet — Strapi's nested `filters.price.{$gte,$lt}`
  doesn't have a flat-param analogue without a small backend addition.
  Added `priceMin`/`priceMax` (`NumberFilter`, `lookup_expr="gte"`/`"lt"`)
  to `CourseFilter` and a new `ProductFilter` (category/type/condition +
  the same two), wired `ProductViewSet.filterset_class = ProductFilter`
  (was a bare `filterset_fields` list with no range support). `data.ts`'s
  `priceBandFilter()` helper renamed `priceBandQuery()` and now returns
  `{ priceMin?, priceMax? }` instead of a Strapi `$gte`/`$lt` object.
- `getSavedJobSlugs`/`getCourseLessonProgress` dropped Strapi's
  `populate`/`pagination` query keys entirely — neither has any DRF
  equivalent need: `SavedJobsView` already always returns
  `{job: {slug}}` via `SavedJobSerializer` with no populate control
  needed, and `LessonProgressView` already self-limits to `[:100]`
  server-side and reads `?courseId=` (kept as-is, camelCase, matching
  the existing Django view's own param name — not a Strapi convention,
  just what that view already expected).
- `getJobs`'s Strapi `fields: [...]` list-payload-trimming param was
  dropped with no replacement — confirmed by reading `JobViewSet` that
  Django already always uses the same full `JobSerializer` for both list
  and detail (no separate trimmed-list serializer exists), so there was
  never a Django-side mechanism to forward that param to in the first
  place; this only means list responses carry a few more fields than
  Strapi's trimmed payload did, which `mapJob()` already tolerates.
- Verified end-to-end in a real browser, not just `tsc`: seeded a small
  set of throwaway rows directly into Django (one job per
  field/locationType, two courses spanning two price bands, one product,
  one brand, one contest), pointed a local `next dev` at the local Django
  server (`STRAPI_URL` temporarily flipped to `localhost:8001`, reverted
  immediately after testing — production's env var is untouched and this
  isn't the Stage 15 cutover), and confirmed `/jobs`, `/courses`, `/shop`,
  `/contests`, `/brands` all render the seeded rows, that `?field=`,
  `?location=`, `?query=` on `/jobs` and `?price=` on `/courses` each
  correctly filtered down to just the matching row, and that
  `npx tsc --noEmit` passes clean. All seeded rows deleted afterward.

**Files touched:**
- `src/lib/data.ts` (`getJobs`, `getContests`, `getCourses`, `getProducts`,
  `getBrands`, `getSavedJobSlugs`, `getCourseLessonProgress`,
  `priceBandFilter` → `priceBandQuery`)
- `backend_django/apps/marketplace/filters.py` (`CourseFilter` gets
  `priceMin`/`priceMax`; new `ProductFilter`)
- `backend_django/apps/marketplace/views.py` (`ProductViewSet.
  filterset_class = ProductFilter`; `ordering_fields` added to
  `ContestViewSet`, `BrandViewSet`, `ProductViewSet`)

**Notes/deviations:**
- `src/lib/strapi.ts` needed no changes at all — confirmed this in
  advance rather than assuming it, since the plan explicitly scoped this
  stage to "`src/lib/data.ts`'s internal query-building" only, and it
  was worth verifying that scoping was actually accurate before writing
  any code.
- The price-range filter addition to the Django backend was the one
  piece of this stage that touched backend code rather than purely
  `data.ts` — a deliberate, minimal exception to the stage's frontend-only
  framing, since there was no way to express a price band as a flat query
  param without it (the alternative — fetching an unbounded page and
  filtering client-side — would have broken `total`/`pageCount` pagination
  math, which contests' existing client-side status filter already
  tolerates only because Strapi data can have a genuinely invalid status
  value, not as a general pattern worth extending to a case that has a
  clean server-side answer).

## Stage 15 — Deploy + cutover
**Status:** Not started
**What's implemented:**
**Files touched:**
**Notes/deviations:**
