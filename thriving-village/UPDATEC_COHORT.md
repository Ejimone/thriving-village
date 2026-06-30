Implement/verify the Academy backend (Django) against this exact API contract. The
frontend (a separate Next.js codebase) is already built against every shape and
endpoint below — match it precisely, don't improvise field names or envelopes.
Where a section says "already built," verify your implementation matches before
moving on; where it says "NEW — build this," it doesn't exist yet.

============================================================
WIRE CONTRACT (applies to every endpoint below)
============================================================
- Base path: `/api` prefix on every route.
- Success envelope: `{ "data": <payload> }` for single resources, and
  `{ "data": [...], "meta": { "pagination": { "page", "pageSize", "pageCount", "total" } } }`
  for core CRUD list reads. Custom (non-CRUD) routes return plain `{ "data": <hand-shaped payload> }`
  — not all of them include `meta`.
- Error envelope: `{ "error": { "message": "<string>", "status": <int> } }` on every non-2xx response.
- Auth: `Authorization: Bearer <jwt>` header. Sign-in issues the jwt; every other
  authenticated route reads it from this header, not a cookie (cookies are a
  frontend-only concern).
- "Null not 404": endpoints that read a single optional resource (material for
  a day, open cohort for a course, team for an enrollment) return `{ "data": null }`
  when absent — never a 404 for "exists but empty."
- Admin always bypasses ownership/role checks on every endpoint below (facilitator
  scoping, judge anonymity boundaries excepted — admin still never gets judge identity
  on judge-scoped reads if such a read existed, but admin DOES get the full
  student↔submission↔judgment mapping facilitators get).

============================================================
1. AUTH (already built — verify)
============================================================
POST /api/auth/local
  { "identifier": "<email>", "password": "<password>" }
  → 200 { "jwt": "<token>", "user": { "id", "username", "email", ... } }

GET /api/me
  → 200 { "data": { "id", "username", "email", "role": "Student"|"Facilitator"|"Judge"|"Admin" } }

POST /api/auth/register
  { "username": "<name>", "email": "<email>", "password": "<password>", "role": "student" }
  → 200 { "jwt": "<token>" }
  Must accept role "student" (the frontend's self-serve sign-up already calls this).
  `facilitator`/`judge`/`admin` are NOT self-serve — only assignable via the role-change
  endpoint below, by an existing admin.

User profile fields beyond Strapi defaults: `name` (string, nullable), `whatsapp`
(string, nullable) — both admin-settable, displayed instead of username/email
wherever a human name is shown (roster, teammate contact, certificates).

============================================================
2. PERMISSION MATRIX
============================================================
| Capability                                    | Student | Facilitator (own cohorts) | Judge | Admin |
|---|---|---|---|---|
| Browse categories/courses                     | public  | public                     | —     | public |
| Own enrollments / daily flow                   | ✅ own  | —                          | —     | ✅    |
| Submit task                                    | ✅ own  | —                          | —     | —     |
| Apply to a course / view own applications      | ✅ own  | —                          | —     | —     |
| Request early access                           | ✅ own  | —                          | —     | —     |
| Grant early access                             | —       | ✅                         | —     | ✅    |
| Roster / student profile / top-rated           | —       | ✅                         | —     | ✅    |
| Threshold / shortlist / remove / bulk-remove   | —       | ✅                         | —     | ✅    |
| Transfer / transfer-bulk                       | —       | ✅                         | —     | ✅    |
| Rollout next week                              | —       | ✅                         | —     | ✅    |
| Sessions (read)                                | ✅ own cohort | ✅                   | —     | ✅    |
| Sessions (create)                              | —       | ✅                         | —     | ✅    |
| Teams match/clear/get                          | —       | ✅                         | —     | ✅    |
| Teammate contact (own)                         | ✅ own  | —                          | —     | —     |
| Judge queue / rate                             | —       | —                          | ✅    | —     |
| Material read                                  | ✅ if enrolled | ✅ if theirs          | —     | ✅    |
| Material author (write)                        | —       | —                          | —     | ✅    |
| Cohort/course/category CRUD                    | —       | —                          | —     | ✅    |
| Set/edit cohort capacity                       | —       | —                          | —     | ✅    |
| Admin overview/top-rated/activity/applications | —       | —                          | —     | ✅    |
| Certificate verify                             | public  | public                     | public| public |

A facilitator hitting another facilitator's cohort → 403 (server-side policy,
not hidden UI). Judge endpoints never return student name/email/cohort/other
judges' scores, enforced via denormalized fields so the identity-bearing
relation is never even queried in that code path — not just filtered output.

============================================================
3. DATA SHAPES
============================================================

Category
  { id, documentId, name, slug, blurb, createdAt, updatedAt, publishedAt }

Course (catalogue)
  {
    id, documentId, title, slug,
    category: number,        // bare category id — do NOT populate as an object, even if asked
    categorySlug: string,    // denormalized alongside it
    months: number,          // 3–6
    certificate: boolean,
    weeksTotal: number,      // months * 4, real stored column
    daysTotal: number,       // weeksTotal * 7, real stored column
  }

Cohort
  {
    id, documentId, name,              // e.g. "Cohort 7"
    weeksTotal, daysTotal,
    startDate: "YYYY-MM-DD",
    status: "Enrolling" | "Running" | "Completed",
    releasedWeek: number,
    minCompletion: number,             // threshold %, default 60
    checkWeeks: number[],              // e.g. [4, 8]
    capacity: number | null,           // NEW — max self-serve enrollments, null = uncapped
    course: { id, title, slug, ... },
    facilitator: <relation, not in default list reads — ownership check only>
  }
  `GET/PUT /cohorts/:id/threshold` is a projection/patch of `minCompletion`+`checkWeeks` only —
  there's no separate Threshold table.

Enrollment
  {
    id, documentId,
    status: "In progress" | "Starting soon" | "Completed",
    currentDay: number,
    submittedDays: number[],
    earlyAccessRequested: boolean,
    earlyWeeks: number[],
    removed: boolean,        // per (student, cohort) "bin" flag, restorable
    shortlisted: boolean,    // per (student, cohort)
  }
  Roster/bin/shortlist reads are just `WHERE cohort=X AND removed=true/false` server-side.

Application — NEW
  {
    id,
    status: "Waitlisted" | "Enrolled" | "Cancelled",
    course: <relation>,
    user: <relation>,
    createdAt,   // the FIFO ordering key — don't add a separate "appliedAt" field
  }

Material (admin-authored, per course+day)
  {
    text: string | null,
    externalVideoUrl: string | null,    // write key is `videoUrl`, stored/read key is `externalVideoUrl`
    task: string | null,
    taskDetail: string | null,
    docs: { label: string, href: string }[],
    hasVideoPlayback: boolean,          // true once a Mux asset is ready
  }
  Two independent video paths: `externalVideoUrl` (plain ungated link) and Mux
  (gated/signed, surfaced only as `hasVideoPlayback` — raw playback id is never
  returned by this endpoint, it's a private field).

Submission
  { id, day, week, task, courseTitle, url, note, submittedAt, rated: boolean, anonHandle }

Judgment
  { brief: 1-5, craft: 1-5, originality: 1-5, average: number, feedback: string }
  Never includes which judge gave it, on any view including facilitator/admin.

Live session
  { id, title, type: "Live call" | "Workshop", day: string, time: string, host: string, link: string | null }
  `day`/`time` are free-text labels, not parseable dates.

Team
  { id, week: number, title: string, members: [{ id, name, email, whatsapp }] }

Certificate (public verify response only)
  { studentNameSnapshot, courseTitleSnapshot, cohortNameSnapshot, issuedAt }
  Snapshots taken at issuance — don't live-join, so a later name change doesn't alter old certs.
  No PDF — this endpoint returns the verifiable record only.

============================================================
4. STUDENT ENDPOINTS (already built — verify)
============================================================
All require a `student`-role jwt, scoped to own resources (someone else's `:id` → 404, not 403).

GET  /api/academy-enrollments                          → standard {data,meta} list, scoped to self
GET  /api/academy-enrollments/:id
POST /api/enrollments/:id/submissions   { day, url, note? }
  → 200 { "data": { currentDay, submittedDays, releasedWeek, earlyWeeks } }
  Hard rule: `day` must equal the enrollment's current `currentDay` exactly, else
  `400 "You can only submit today's task."` — server is the source of truth for "today."
GET  /api/enrollments/:id/submissions   → { "data": [Submission, ...] }
POST /api/enrollments/:id/early-access/request → { "data": { "earlyAccessRequested": true } }
GET  /api/enrollments/:id/team          → { "data": [TeamMate,...] | null }
GET  /api/courses/:courseId/days/:day/material
GET  /api/courses/:courseId/curriculum  (public, no auth)
  → { "data": { weeksTotal, daysTotal, weeks: [{ week, days: [{ day, hasMaterial }] }] } }
GET  /api/cohorts/:id/sessions          → { "data": [LiveSession,...] }

============================================================
5. FACILITATOR ENDPOINTS (already built — verify)
============================================================
All require `facilitator` role; every `:id` is a cohort the facilitator must own
(`cohort.facilitator == self`) — non-owner gets 403.

GET  /api/facilitator/cohorts
GET  /api/cohorts/:id/roster            → { "data": [{ userId, name, dayReached, lastActive, standing, shortlisted }] }
  Excludes removed students. `standing` = "on-track"(≥85% pace) | "behind"(≥60%) | "at-risk"(else),
  computed each read, not stored. `lastActive` = human label from enrollment.updatedAt.
GET  /api/cohorts/:id/students/:uid     → { "data": { userId, name, dayReached, standing, submissions[], judgments[] } }
GET  /api/cohorts/:id/top-rated         → { "data": [{ userId, name, avgScore }] }  sorted desc, ≥1 rated submission
POST /api/cohorts/:id/students/:uid/shortlist  → { "data": { "shortlisted": bool } }  (toggles)
POST /api/cohorts/:id/students/:uid/remove     → { "data": { "removed": true } }
POST /api/cohorts/:id/students/:uid/restore    → { "data": { "removed": false } }
POST /api/cohorts/:id/students/remove-bulk     { "userIds": [...] } → { "data": { "removedCount": n } }
GET  /api/cohorts/:id/threshold         → { "data": { minCompletion, checkWeeks } }
PUT  /api/cohorts/:id/threshold         { minCompletion, checkWeeks } → same shape back
POST /api/cohorts/:id/rollout-next-week → { "data": { "releasedWeek": n } }
  Bumps releasedWeek by 1 (clamp to weeksTotal) AND auto-advances every caught-up student
  in the same call. Also runs automatically once a day from a cron computing expected
  week from `startDate`.
GET  /api/cohorts/:id/early-access-requests → { "data": [{ enrollmentId, userId, name, currentDay }] }
POST /api/enrollments/:id/early-access/grant → { "data": { earlyWeeks, currentDay } }
  `:id` is enrollment id, not cohort id. Clears earlyAccessRequested, adds exactly
  `releasedWeek+1` to earlyWeeks, immediately advances currentDay if caught up.
GET  /api/cohorts/:id/sessions
POST /api/cohorts/:id/sessions          { title, type: "Live call"|"Workshop", day, time, host, link? }
POST   /api/cohorts/:id/teams/match     { teamSize, title? } — deletes existing teams first, chunks
                                            active roster into groups of teamSize. Default title:
                                            "Week N group project" (N = current releasedWeek)
DELETE /api/cohorts/:id/teams
GET    /api/cohorts/:id/teams           → { "data": [Team,...] }
POST /api/cohorts/:id/students/:uid/transfer        { targetCohortId } → { "data": { cohortId, currentDay } }
POST /api/cohorts/:id/students/transfer-bulk        { userIds, targetCohortId } → { "data": { transferredCount, skippedUserIds } }
  Keeps account/progress/submission/judgment history — only the cohort relation changes.
  `:id` = source cohort the facilitator must own; targetCohortId must run the same course.
GET  /api/courses/:courseId/days/:day/material   (read-only for facilitator)

============================================================
6. ADMIN ENDPOINTS (already built — verify)
============================================================
Requires `admin` role — same admin account as the main site.

GET/POST/PUT/DELETE /api/academy-categories
GET/POST/PUT/DELETE /api/academy-courses
GET/POST/PUT        /api/academy-cohorts        (no DELETE exposed)
GET/POST/PUT        /api/academy-enrollments    (manual enroll — POST body: { data: { user, cohort, status:"Starting soon", currentDay:1, submittedDays:[], earlyWeeks:[] } })
  Standard core-CRUD shape: write body is `{ "data": {...fields} }`, response `{ "data": {id,...fields}, "meta": {} }`.
  Cohort create body includes the NEW `capacity` field (number, optional/nullable).

PUT  /api/courses/:courseId/days/:day/material   { videoUrl, text, task, taskDetail, docs[] } → upserts
DELETE /api/courses/:courseId/days/:day/material → { "data": { "deleted": true } }
POST /api/courses/:courseId/days/:day/material/mux-upload → { "data": { uploadUrl, uploadId } }
  Admin frontend PUTs the video file directly to uploadUrl (browser→Mux, not through this backend).

GET /api/admin/overview   → { "data": [{ label, value }] }  cached 90s server-side
GET /api/admin/top-rated  → { "data": [{ userId, name, avgScore }] }  platform-wide
GET /api/admin/activity   → { "data": [{ who, what, when }] }  last 10 events

GET  /api/admin/users?role=&search=   → { "data": [{ id, name, email, whatsapp, role? }] }
POST /api/admin/users                 { name, email, username, password } → creates a Student account
PUT  /api/admin/users/:id/role        { role: "Student"|"Facilitator"|"Judge"|"Admin" } → role change

GET /api/cohorts/:id/roster-requests       (facilitator's own requests)
GET /api/admin/roster-requests             (every request, for admin inbox)
PUT /api/roster-requests/:id               { status: "Fulfilled"|"Dismissed" }
POST /api/cohorts/:id/roster-requests      { count?, note? }  (facilitator creates)

============================================================
7. JUDGE ENDPOINTS (already built — verify)
============================================================
Requires `judge` role. Hard rule: response never includes student name, email,
cohort, or any other judge's score.

GET  /api/judge/queue
  → { "data": [{ "id": "Entry A12", submissionId, course, task, week, submittedAgo, url, note? }] }
  `id` is the anon handle (display name), `submissionId` is the numeric id used below.
  Only unrated submissions appear; an item vanishes from every judge's queue the instant
  any judge rates it (single-judge-rates-once, no consensus/averaging).
POST /api/judge/submissions/:submissionId/rate
  { scores: { brief, craft, originality }, feedback } → { "data": { average } }
  Re-rating an already-rated submission → 409 Conflict.

============================================================
8. MEDIA (already built — verify)
============================================================
General files: Cloudinary (global Media Library upload provider).
Lesson video: Mux, gated/signed —
  1. POST mux-upload → { uploadUrl, uploadId }
  2. browser PUTs file straight to uploadUrl
  3. Mux calls POST /webhooks/mux (signature-verified, not user-authenticated) on
     video.asset.ready → fills in playback id server-side
  4. GET /api/courses/:courseId/days/:day/material/playback-token → { "data": { "token": "<short-lived signed jwt>" } }
     Known gap: this doesn't also return `playbackId` (private field). If you can, add
     it to the response now — it's a one-line fix and the frontend will need it.
Until MUX_WEBHOOK_SECRET is configured, the webhook rejects every call — upload
creation and token minting still work without it.

============================================================
9. BUSINESS RULES (cross-cutting, not obvious from shapes alone)
============================================================
- Daily gate: submit day d → adds d to submittedDays. currentDay advances to d+1
  ONLY if weekOf(d+1) <= releasedWeek (or that week ∈ earlyWeeks). Otherwise student
  is "caught up" — no separate field for this, frontend infers it.
- Weekly rollout: releasedWeek advances via manual trigger OR a daily cron computing
  expected week from startDate. Either path auto-advances every caught-up student
  in the same operation.
- Early access: request→grant is two-step human approval, not automatic.
- Judge anonymity: enforced via denormalized fields at submission-creation time so
  the judge query path never touches the identity-bearing relation at all.
- Facilitator scoping: a route policy resolves the target cohort (directly, or via
  the enrollment for enrollment-scoped routes) and checks `cohort.facilitator.id === currentUser.id`,
  admin bypasses. Returns 403, never a silently-filtered empty result.
- Certificates: auto-issued (no manual endpoint) the instant currentDay reaches
  daysTotal, only if course.certificate === true. Idempotent — one per enrollment.

============================================================
10. NEW — SELF-SERVE COHORT ASSIGNMENT (build this — does not exist yet)
============================================================
ALX-style: a student applies to a COURSE, not a cohort directly. Server finds that
course's currently-open cohort and either enrolls immediately (room available) or
waitlists (full, or none currently open) — FIFO by application time.

Schema:
- Cohort gets `capacity: number | null` (null = uncapped) — already listed in §3 above.
- New Application model: `user` FK, `course` FK, `status: Waitlisted|Enrolled|Cancelled`,
  rely on built-in `createdAt` as the FIFO timestamp.

GET /api/courses/:courseId/open-cohort   (public, no auth)
  → 200 { "data": { "id", "documentId", "name", "startDate", "capacity", "seatsLeft" } }
     or { "data": null }   // no cohort currently "Enrolling" for this course
  `seatsLeft` is null when capacity is null.

POST /api/courses/:courseId/apply   (student role, auth required, no body)
  Enrolled: → 200 { "data": { "status": "enrolled", "enrollmentId", "cohort": { "id", "name", "startDate" } } }
  Waitlisted: → 200 { "data": { "status": "waitlisted", "applicationId", "position" } }
    `position` = 1-indexed rank by application time among that course's Waitlisted applications.
  Errors: 404 unknown course. 409 "You've already applied to this course." if the
    student already has a non-removed enrollment for it, or an active Waitlisted
    application for it (re-applying after Cancelled is fine — new row).
  HARD REQUIREMENT: capacity check + enrollment creation must be atomic (transaction /
  select_for_update) — two students applying for the last seat simultaneously must
  not both get in.

GET /api/me/applications   (student, own only)
  → 200 { "data": [{ "id", "status", "position", "course": {"id","title","slug"}, "createdAt" }] }
  `position` only meaningful (non-null) when status === "Waitlisted".

POST /api/applications/:id/cancel   (student, own only)
  → 200 { "data": { "status": "Cancelled" } }
  409 if already Enrolled or Cancelled.

GET /api/admin/applications   (admin)  optional ?status=Waitlisted filter
  → 200 { "data": [{ "id", "status", "position", "user": {"id","name","email"}, "course": {"id","title"}, "createdAt" }] }

Business rules for this feature:
- Auto-promote (FIFO): whenever a course gains open-cohort capacity — a new
  "Enrolling" cohort created for it, an existing one's capacity raised, or the
  daily cron's safety-net sweep — the oldest Waitlisted applications for that
  course convert to enrollments first, up to the new seat count.
- Cohort auto-close: extend the EXISTING daily cron (the one in §9 that advances
  releasedWeek from startDate) to also flip a cohort from "Enrolling" to "Running"
  the day startDate arrives — don't add a second scheduled job. Do the close-step
  before that run's promote() sweep, so a cohort crossing its start date stops
  taking new applicants in the same run. If a course still has waitlisted
  applicants and no other open cohort afterward, they correctly stay waitlisted
  until admin opens the next cohort instance — expected, not a bug.
- Capacity null = uncapped — every applicant before startDate gets in immediately.
- No email/SMS notification in this pass — confirm whether this Django stack has
  an email backend configured; if not, skip it. In-app state (the apply response +
  GET /me/applications) is enough for now.
- Manual assignment is unaffected — admin/facilitator can still hand-enroll via
  POST /academy-enrollments or transfer/transfer-bulk. Self-serve apply is the new
  default path, not a replacement.

============================================================
11. KNOWN GAPS (deferred, not in scope for this pass)
============================================================
- No certificate PDF — verify endpoint returns the record only, not a rendered document.
- No real datetime on live sessions — day/time stay free-text labels.
- getPlaybackToken doesn't return playbackId — fix if convenient (§8).
- Single-judge-rates-once — no multi-judge consensus.

============================================================
WHEN DONE
============================================================
Report back anything that ended up shaped differently than this spec (field
renames, different error codes, etc.) — especially for §10, which is new. Also
flag any other drift you find between this contract and what you actually built,
the same way `Course.category` (bare id, not populated — see §3) was already
caught and documented.
