# Academy backend — expected fixes

Running list of confirmed bugs/gaps in the Django Academy backend
(`backend_django/apps/academy/`), found by testing the live server and
reading the source directly (`views.py`, `admin_dashboard_views.py`,
`serializers.py`, `models.py`, `apps/accounts/urls.py`). Everything here is
**confirmed**, not speculation — each item says how it was confirmed.

The frontend (`ACADEMY_API_REFERENCE.md` in the `thriving-village` repo) has
already been updated to call the *real* current paths/shapes for everything
below that's just a rename. The items in this file are the ones that need an
actual backend code change, not just a frontend path update.

---

## Critical — breaks existing screens, not just the new feature

### 1. `Cohort.course` and `Enrollment.cohort` serialize as bare ids, not nested objects

**File:** `apps/academy/serializers.py`

`AcademyCohortSerializer.course` and `AcademyEnrollmentSerializer.cohort`
have no override — both are plain entries in `Meta.fields`, so DRF's default
`ModelSerializer` behavior kicks in and returns just the FK's integer id.
`facilitator` on the same serializer *does* get special treatment
(`SerializerMethodField` → `{id, name}`), so the pattern already exists,
it just wasn't applied to `course`/`cohort`.

**Impact:** every screen that reads `cohort.course.title`,
`cohort.course.category`, or `enrollment.cohort.name`/`.daysTotal`/`.course.title`
renders blank — admin cohorts table, admin cohort detail page, student "My
courses" dashboard, facilitator dashboard. Won't crash (the frontend already
defends against missing nested fields with optional chaining + fallbacks),
just silently shows empty course/cohort names everywhere.

**Confirmed by:** reading `AcademyCohortSerializer`/`AcademyEnrollmentSerializer`
in `serializers.py` — no `course`/`cohort` override exists, only `facilitator`
does. Not independently re-verified via an authenticated curl (no test
account with an enrollment was available this session) — but the source is
unambiguous: there's no code path that would nest it.

**Suggested fix:** give `course` a `SerializerMethodField` on
`AcademyCohortSerializer` returning `{id, title, slug, categorySlug}` (same
shape `AcademyCourseSerializer` itself returns), and give `cohort` a
`SerializerMethodField` on `AcademyEnrollmentSerializer` returning the full
`AcademyCohortSerializer` shape (so it gets `course` nested too, transitively).

---

### 2. `GET .../academy-enrollments/:id/team` ("my teammates") doesn't exist

**File:** `apps/academy/views.py`, `AcademyEnrollmentViewSet`

Only three actions exist on this viewset: `request-early-access`,
`submit-task`, `submissions`. There's no student-facing "who are my
teammates for this assignment" endpoint anywhere. `AcademyTeamViewSet` only
has facilitator/admin-scoped actions (`rename`, `members` add/remove) — no
student read path.

**Impact:** a student can never see their own team's contact info
(name/email/whatsapp) once matched — the team-contact feature is entirely
non-functional for students, even though teams get created fine
(facilitator-side match/create works).

**Confirmed by:** reading every `@action` on `AcademyEnrollmentViewSet` and
`AcademyTeamViewSet` — exhaustive, not a guess. Also confirmed live: `GET
/api/academy-enrollments/1/team` 404s with Django's routing-level 404 page
(URL pattern doesn't match at all, not a permission/object-not-found error).

**Suggested fix:** add a `team` action to `AcademyEnrollmentViewSet` (GET,
detail=True) that resolves the enrollment's user + cohort, finds the
`AcademyTeam` containing that user in that cohort, and returns the other
members' `{id, name, email, whatsapp}` (excluding self) — or `null` if not
yet matched into a team.

---

### 3. "Grant early access" doesn't exist — not even the business logic

**File:** `apps/academy/views.py`

Searched the whole file (and `apps/academy/progression.py`) for "grant" —
only `request_early_access` (student requests, sets
`early_access_requested = True`) and `early_access_requests` (facilitator
lists pending requests) exist. There's no grant/approve action, and no
underlying service function that would do the actual unlock (add
`releasedWeek + 1` to the student's `earlyWeeks`, advance `currentDay` if
caught up). This is a full gap — the approval half of the request→grant flow
was never built.

**Impact:** a facilitator can see who's requesting early access but has no
way to actually grant it. The early-access feature is half-built.

**Confirmed by:** `grep -rn "grant"` across `apps/academy/` and
`apps/accounts/` returns nothing relevant — no view, no service function,
nothing.

**Suggested fix:** add a `grant-early-access` action on
`AcademyEnrollmentViewSet` (POST, detail=True, facilitator/admin only,
ownership-checked the same way `request_early_access` is) that: clears
`early_access_requested`, appends `cohort.released_week + 1` to
`enrollment.early_weeks` (not a range — exactly that one week), and re-runs
the same progression/advance logic `rollout_next_week` already uses for a
single enrollment. Suggested route: `POST
/api/academy-enrollments/:id/grant-early-access` (matches the existing
`request-early-access` naming convention). Response:
`{ "data": { "earlyWeeks": [...], "currentDay": N } }`.

---

## Confirmed bugs (not gaps — behavior that's just wrong)

### 4. Strapi-style `filters[x][$eq]=y` query syntax is silently ignored

**Confirmed live:**
```
GET /api/academy-courses?filters[id][$eq]=32              → returns all 19 courses, unfiltered
GET /api/academy-courses?filters[category][id][$eq]=12    → returns all 19 courses, unfiltered
GET /api/academy-courses?category=12                       → correctly filters to 3 courses
```
Only plain DRF `filterset_fields` query params work (`?category=12`, since
`AcademyCourseViewSet.filterset_fields = ["category"]`). The bracket syntax
isn't parsed at all — it's not erroring, it's just being ignored as an
unrecognized query param, so the request silently returns the unfiltered list.

**Impact:** any caller using the bracket syntax to filter gets back
everything instead of a filtered subset. The frontend has already been
patched to stop using bracket filters against this backend (uses plain
`?category=12` now, and resolves "get course by numeric id" by fetching the
full list and finding it client-side instead of trying to filter
server-side) — but if anything else in the platform (admin panel, scripts,
the future Academy frontend if a different client tries it) relies on
Strapi's filter syntax against this backend, it'll silently misbehave the
same way.

**Suggested fix:** either implement bracket-filter parsing generically (if
other endpoints are expected to support it), or just confirm explicitly that
`filterset_fields`/plain query params are the supported convention going
forward so nothing else gets built against the assumption it works.

### 5. Rate-submission body is flat, not nested under `scores`

**File:** `apps/academy/serializers.py`, `RateSubmissionSerializer`

```python
class RateSubmissionSerializer(serializers.Serializer):
    brief = serializers.IntegerField(min_value=0, max_value=10)
    craft = serializers.IntegerField(min_value=0, max_value=10)
    originality = serializers.IntegerField(min_value=0, max_value=10)
    feedback = serializers.CharField()
```
This isn't a bug exactly — just flagging because the originally documented
contract had the body as `{ "scores": { "brief", "craft", "originality" },
"feedback" }` (nested), and the real implementation is flat:
`{ "brief", "craft", "originality", "feedback" }`. The frontend's
`rateSubmissionAction` has been updated to send the flat shape. No backend
change needed — just confirming this is the intended final shape, not an
oversight, since it's a one-way door (changing it now would break whatever
already calls it).

Also note: `brief`/`craft`/`originality` are validated `0–10` here, not the
originally documented `1–5` scale. If that's intentional (a finer-grained
rubric), fine — just flagging in case `1–5` was the actual intent and `0–10`
is a copy-paste from a different field.

---

## Confirmed-fine — no action needed, just documenting what was verified

- `POST /api/courses/:slug/apply` and `/open-cohort` return the documented
  shapes exactly, just under `/academy-courses/:slug/...` and keyed by slug
  rather than numeric id. `apply` returns `201`, not `200` — fine, the
  frontend's HTTP client treats any 2xx as success.
- `GET /me/academy-applications`, `POST /academy-applications/:id/cancel`,
  `GET /academy-admin/applications` all match the §11 spec exactly (shape,
  status codes, error messages) — just path-prefixed differently than first
  drafted.
- Auth realm separation is total and clean: the old shared `/api/auth/local`
  correctly 400s for an Academy account's credentials, and shared
  `/api/auth/register` correctly rejects `role: "student"`. No partial/leaky
  behavior between the two user tables.
- `playbackId` is already included in the `playback-token` response
  (`{ "token", "playbackId" }`) — the gap noted in the original spec doc is
  already resolved.
