# Academy Cohort Management — API Reference

This is a focused reference for everything involved in **managing a cohort's lifecycle**
in the Academy backend: creating/editing/deleting cohorts, and every operation on its
roster — shortlist, remove, restore, bulk-remove, and **transfer** (move a student to a
different cohort). It's a drill-down on top of [`ACADEMY_API_REFERENCE.md`](ACADEMY_API_REFERENCE.md)
(§5/§6 there cover the same endpoints more briefly, alongside everything else in the
backend) — read that doc first for auth, data types, and the rest of the API. This doc
exists because cohort lifecycle management (especially transfer + delete, which depend
on each other) has enough business-rule nuance to deserve its own write-up.

**Base URL:** `http://localhost:1337/api` in local dev. Same Strapi v5 REST API, same JWT auth.

**Who can do this:** `facilitator` (scoped to cohorts where `cohort.facilitator == self`
for everything except `create`/cohort-`delete`, which are core CRUD and admin-only) and
`admin` (full access, no scoping, bypasses ownership checks everywhere). A facilitator
hitting a cohort they don't own gets **403** — enforced server-side by a policy
(`global::is-cohort-facilitator`), not just hidden in the UI.

---

## 1. Cohort CRUD

Cohorts themselves (`name`, `course`, `facilitator`, schedule, thresholds) are standard
Strapi core CRUD, **admin-only** (facilitators manage their cohorts' rosters, but don't
create/edit/delete the cohort record itself).

### Create
```
POST /api/academy-cohorts
{ "data": { "name": "Cohort 8", "course": <courseId>, "facilitator": <userId>, "weeksTotal": 13, "daysTotal": 90, "startDate": "2026-07-01", "status": "Enrolling" } }
→ { "data": { "id": 2, "documentId": "ncyg1oocuq9jzoq74ks2uhrg", "name": "Cohort 8", "weeksTotal": 13, "daysTotal": 90, "startDate": "2026-07-01", "status": "Enrolling", "releasedWeek": 0, "minCompletion": 60, "checkWeeks": [4, 8], ... }, "meta": {} }
```
`status` is `"Enrolling" | "Running" | "Completed"`. `releasedWeek` defaults to 0;
`minCompletion`/`checkWeeks` default to `60`/`[4, 8]` (see §6 — Threshold below to change
them after creation). To find a `facilitator` id by name instead of typing a raw user id,
use `GET /admin/users?role=Facilitator&search=...` ([ACADEMY_API_REFERENCE.md §6](ACADEMY_API_REFERENCE.md)).

### Read
```
GET /api/academy-cohorts                  // list, standard {data, meta} envelope
GET /api/academy-cohorts/:documentId      // single
GET /api/facilitator/cohorts              // "my cohorts" — facilitator-scoped, no :id needed
```
All three include `facilitator: { id, name } | null` on every cohort — `null` flags a
cohort with no facilitator assigned yet.

### Update
```
PUT /api/academy-cohorts/:documentId
{ "data": { "status": "Running", "releasedWeek": 2 } }
```
Standard partial-update semantics — only send the fields you're changing. Use the
dedicated **Threshold** endpoint (§6) for `minCompletion`/`checkWeeks` instead of a raw
PUT — it's the same effect but matches how the facilitator UI already calls it.

### Delete
```
DELETE /api/academy-cohorts/:documentId
→ 204 (no body)
```
**Guarded.** Rejects with 400 if the cohort has *any* enrollment with `removed: false`
(an active student still on the roster):
```json
{ "error": { "status": 400, "name": "BadRequestError", "message": "Remove or transfer all active students before deleting this cohort.", "details": {} } }
```
You have two ways to clear the guard — pick whichever fits:
- **Remove** each active student (§3) — keeps their enrollment record, just bins it.
- **Transfer** each active student (§4) to a different cohort running the same course —
  keeps them active, just moves them. This is the one you want when a cohort is being
  cancelled/merged and its students should keep going, not get binned.

Once the cohort has zero `removed: false` enrollments, delete succeeds. On success, the
cohort's **live sessions and teams cascade-delete** with it (not meaningful without the
cohort) — but enrollments are **never** touched by cohort delete, even removed ones; a
removed enrollment that still points at the deleted cohort just loses that relation
(becomes `cohort: null`), it isn't deleted itself. Enrollment history is the one thing
this whole guard exists to protect.

---

## 2. Roster read

```
GET /api/cohorts/:id/roster
→ { "data": [ { "userId": 12, "name": "Ada Okonkwo", "dayReached": 16, "lastActive": "today", "standing": "behind", "shortlisted": false } ] }
```
`:id` is the cohort's numeric id (not documentId, for this and every other custom
`/cohorts/:id/...` route below — these are hand-written routes, not core CRUD, so they
don't follow the documentId convention). Excludes removed (binned) students.
`standing` (`"on-track" | "behind" | "at-risk"`) is derived from pace vs. released
weeks each read, not stored.

```
GET /api/cohorts/:id/students/:uid
→ { "data": { "userId": 12, "name": "Ada Okonkwo", "dayReached": 16, "standing": "behind", "submissions": [...], "judgments": [...] } }
```
`:uid` is the user id. `judgments` never includes which judge gave the score, even here.

---

## 3. Shortlist / remove / restore / bulk-remove

These act on the `shortlisted`/`removed` booleans on a (student, cohort) enrollment —
they never change which cohort the student is in (see §4 for that).

```
POST /api/cohorts/:id/students/:uid/shortlist
→ { "data": { "shortlisted": true } }   // toggles — calling again flips it back
```

```
POST /api/cohorts/:id/students/:uid/remove
→ { "data": { "removed": true } }
```
Soft-delete. The enrollment record (progress, submissions, judgments) is untouched —
this just hides the student from the active roster and clears their `shortlisted` flag.
Reversible:
```
POST /api/cohorts/:id/students/:uid/restore
→ { "data": { "removed": false } }
```

```
POST /api/cohorts/:id/students/remove-bulk
{ "userIds": [12, 13] }
→ { "data": { "removedCount": 2 } }
```
Same as `remove`, batched. No bulk-restore exists today (restore one at a time) —
this wasn't a common-enough flow to build, since restoring is normally a single
"I made a mistake" correction.

`:uid` is the **user id** everywhere in this section, not the enrollment id.

---

## 4. Transfer (move a student to a different cohort)

The student keeps their account, their progress, their submission/judgment history —
only which cohort they're enrolled in changes.

### Single student
```
POST /api/cohorts/:id/students/:uid/transfer
{ "targetCohortId": 13 }
→ { "data": { "cohortId": 13, "currentDay": 16 } }
```
`:id` is the **source** cohort (the one the facilitator-ownership policy checks — you
must own/admin the cohort you're moving a student *out of*). `:uid` is the user id.

### Bulk
```
POST /api/cohorts/:id/students/transfer-bulk
{ "userIds": [12, 13], "targetCohortId": 13 }
→ { "data": { "transferredCount": 1, "skippedUserIds": [13] } }
```
Doesn't fail the whole batch if one student can't be transferred (e.g. already
enrolled in the target) — that student's id lands in `skippedUserIds` and everyone
else still goes through.

### Rules (all enforced server-side, verified live)

| Rule | Rejection |
|---|---|
| Target cohort must run the **same course** as the source | `400 "Can only transfer to a cohort running the same course."` |
| Target cohort must not be `"Completed"` | `400 "Cannot transfer into a completed cohort."` |
| Target must be a different cohort than the source | `400 "Target cohort must be different from the source cohort."` |
| Student must not already have an enrollment in the target cohort | single: `400 "Student already has an enrollment in the target cohort."` · bulk: added to `skippedUserIds` instead |
| Student must actually be enrolled in the source cohort | `404 "Student not enrolled in this cohort."` |

**Why same-course only:** `currentDay`/`submittedDays`/`weekOf(day)` are meaningless
across two different curricula — a "Frontend Development" cohort and a "Data Science"
cohort don't share a day-by-day schedule. Transferring is for moving someone between
**runs of the same course** (different start dates, different facilitators, a
cancelled/merged cohort), not for switching a student's course entirely — there's no
endpoint for that; it'd mean starting over at day 1 of a different curriculum, which is
just a remove + fresh enroll (§3 / [ACADEMY_API_REFERENCE.md §6](ACADEMY_API_REFERENCE.md)).

**What happens to the enrollment's fields on transfer:**
| Field | Behavior |
|---|---|
| `currentDay` | **Recalculated** against the target cohort's own `releasedWeek`/`daysTotal` via the same `normalize()` used by weekly rollout/early-access — not carried over verbatim. If the target cohort is earlier in its run (lower `releasedWeek`) the student's day gets capped back to what that cohort has actually released. |
| `submittedDays` | Carried over as-is (their submission history is real, course-curriculum-relative work already done). |
| `earlyWeeks` | Carried over as-is (same course, so "week 5 unlocked early" still means the same thing in the new cohort). |
| `removed` | Reset to `false` — transferring is explicitly re-activating them. |
| `shortlisted` | Reset to `false` — shortlist status is a curation fact about the old cohort/facilitator relationship, doesn't carry meaning in a new one. |
| `earlyAccessRequested` | Reset to `false` — a pending request is tied to the old cohort's facilitator; doesn't make sense left dangling after a move. |
| Submissions, judgments, certificates | Untouched — they stay linked to the same enrollment record, which is just re-pointed at a different cohort. Nothing about a student's actual work or grades changes. |

### Typical workflow: deleting a cohort that still has active students
```
GET  /api/cohorts/:id/roster                              → see who's still active
POST /api/cohorts/:id/students/transfer-bulk               → move them to a same-course cohort
  { "userIds": [...allActiveUserIds], "targetCohortId": <anotherCohortRunningTheSameCourse> }
DELETE /api/academy-cohorts/:documentId                     → now succeeds (204)
```

---

## 5. Performance threshold

```
GET /api/cohorts/:id/threshold  → { "data": { "minCompletion": 60, "checkWeeks": [4, 8] } }
PUT /api/cohorts/:id/threshold
  { "minCompletion": 70, "checkWeeks": [4, 8, 12] }
  → { "data": { "minCompletion": 70, "checkWeeks": [4, 8, 12] } }
```
`minCompletion`/`checkWeeks` live directly on the cohort record — this is just a
projection/patch of those two fields, not a separate object.

---

## 6. Weekly rollout

```
POST /api/cohorts/:id/rollout-next-week
→ { "data": { "releasedWeek": 3 } }
```
Bumps `releasedWeek` by 1 (clamped to the cohort's `weeksTotal`) and **auto-advances
every caught-up student** in the same call. Also runs automatically once a day via a
server-side cron job that computes the expected week from the cohort's `startDate` —
manual triggering is for getting ahead of the schedule (e.g. the facilitator decides to
open the next week early for everyone, distinct from per-student early access below).

---

## 7. Early access

```
GET /api/cohorts/:id/early-access-requests
→ { "data": [ { "enrollmentId": 42, "userId": 12, "name": "Ada Okonkwo", "currentDay": 16 } ] }
```
Pending requests for this cohort (students who hit `POST /enrollments/:id/early-access/request`
and are waiting on a facilitator).

```
POST /api/enrollments/:id/early-access/grant
→ { "data": { "earlyWeeks": [3], "currentDay": 15 } }
```
`:id` here is the **enrollment id**, not the cohort id (the policy resolves the
enrollment's cohort and checks that against the facilitator). Adds exactly
`releasedWeek + 1` to `earlyWeeks` and immediately re-advances `currentDay` if the
student was caught up.

---

## 8. Live sessions

```
GET  /api/cohorts/:id/sessions
POST /api/cohorts/:id/sessions
  { "title": "Week 2 group call", "type": "Live call", "day": "Thursday", "time": "6:00 PM WAT", "host": "Chidi Okafor", "link": "https://meet.google.com/..." }
```
`type` is `"Live call" | "Workshop"`. `day`/`time` are free-text labels, not real
datetimes. Sessions cascade-delete with their cohort (§1).

---

## 9. Teams

### Auto-match (re-chunks everyone)
```
POST   /api/cohorts/:id/teams/match   { "teamSize": 3, "title"?: "optional override" }
DELETE /api/cohorts/:id/teams
GET    /api/cohorts/:id/teams         → { "data": [ { "id": 6, "week": 3, "title": "Week 3 group project", "members": [{ "id": 12, "name": "...", "email": "...", "whatsapp": "..." }] } ] }
```
`teamsMatch` deletes **all existing teams for the cohort first**, then chunks the
**active (non-removed)** roster into groups of `teamSize`. Default `title` is
`"Week N group project"` where N is the cohort's current `releasedWeek`. Teams
cascade-delete with their cohort (§1).

### Manual editing (build one team, or tweak a match's output without re-running it)
```
POST   /api/cohorts/:id/teams              { "title": "...", "week": 3, "memberUserIds": [12, 13] }
→ { "data": { "id": 11, "week": 3, "title": "...", "members": [{ "id": 12, "name": "...", "email": "...", "whatsapp": "..." }, ...] } }

PUT    /api/teams/:teamId                  { "title": "..." }
→ { "data": { "id": 11, "title": "..." } }

DELETE /api/teams/:teamId
→ 204 (no body) — deletes just this one team, not the cohort's other teams

POST   /api/teams/:teamId/members          { "userId": 14 }
→ { "data": { "id": 11, "week": 3, "title": "...", "members": [...] } }   // full updated team

DELETE /api/teams/:teamId/members/:userId
→ { "data": { "id": 11, "week": 3, "title": "...", "members": [...] } }   // full updated team
```
`:teamId` accepts either the team's numeric `id` or its `documentId` — same
either-works convention as everywhere else in this backend.

**Ownership.** Scoped exactly like the auto-match routes (`global::is-cohort-facilitator`
for `POST /cohorts/:id/teams`, since `:id` there is a cohort id; a parallel
`global::is-team-cohort-facilitator` policy for the `:teamId`-keyed routes, which resolves
the team → cohort → facilitator before checking — owning facilitator or admin only,
**403** otherwise, verified live with a second facilitator account.

**Rules:**
- `POST /cohorts/:id/teams` requires `title` and a non-empty `memberUserIds[]`. `week`
  defaults to the cohort's current `releasedWeek` (or `1`) if omitted.
- **A student can't be on two teams in the same cohort at once.** `POST /cohorts/:id/teams`
  rejects with 400 and names every conflicting user id if any of `memberUserIds` is
  already on a different team in that cohort:
  ```json
  { "error": { "message": "These students are already on another team in this cohort: 13" } }
  ```
  `POST /teams/:teamId/members` does the same single-user check:
  ```json
  { "error": { "message": "This student is already on another team in this cohort." } }
  ```
- Adding a user who's already on **that same team** is a no-op (returns the current
  team unchanged, not an error) — safe to call without checking first.
- `DELETE /teams/:teamId` only removes that one team — the cohort's other teams are
  untouched (unlike `DELETE /cohorts/:id/teams`, which clears all of them).

---

## 10. Quick reference: every cohort-management endpoint

| Method | Path | Who | Notes |
|---|---|---|---|
| POST | `/academy-cohorts` | admin | create |
| GET | `/academy-cohorts`, `/academy-cohorts/:documentId` | admin | core CRUD read |
| PUT | `/academy-cohorts/:documentId` | admin | core CRUD update |
| DELETE | `/academy-cohorts/:documentId` | admin | guarded — §1 |
| GET | `/facilitator/cohorts` | facilitator | "my cohorts" |
| GET | `/cohorts/:id/roster` | facilitator/admin | §2 |
| GET | `/cohorts/:id/students/:uid` | facilitator/admin | §2 |
| GET | `/cohorts/:id/top-rated` | facilitator/admin | per-cohort leaderboard |
| POST | `/cohorts/:id/students/:uid/shortlist` | facilitator/admin | §3, toggles |
| POST | `/cohorts/:id/students/:uid/remove` | facilitator/admin | §3 |
| POST | `/cohorts/:id/students/:uid/restore` | facilitator/admin | §3 |
| POST | `/cohorts/:id/students/remove-bulk` | facilitator/admin | §3 |
| POST | `/cohorts/:id/students/:uid/transfer` | facilitator/admin | §4 |
| POST | `/cohorts/:id/students/transfer-bulk` | facilitator/admin | §4 |
| GET/PUT | `/cohorts/:id/threshold` | facilitator/admin | §5 |
| POST | `/cohorts/:id/rollout-next-week` | facilitator/admin | §6 |
| GET | `/cohorts/:id/early-access-requests` | facilitator/admin | §7 |
| POST | `/enrollments/:id/early-access/grant` | facilitator/admin | §7 |
| GET/POST | `/cohorts/:id/sessions` | facilitator/admin (POST), anyone enrolled (GET) | §8 |
| POST/DELETE/GET | `/cohorts/:id/teams[/match]` | facilitator/admin | §9, auto-match |
| POST | `/cohorts/:id/teams` | facilitator/admin | §9, create one team manually |
| PUT/DELETE | `/teams/:teamId` | facilitator/admin (owning cohort only) | §9, rename / delete one team |
| POST/DELETE | `/teams/:teamId/members[/:userId]` | facilitator/admin (owning cohort only) | §9, add / remove one member |
| GET | `/admin/users?role=...&search=...` | admin | name-searchable user picker — see [ACADEMY_API_REFERENCE.md §6](ACADEMY_API_REFERENCE.md) |
| DELETE | `/academy-enrollments/:documentId` | admin | hard-delete, guarded — see [ACADEMY_API_REFERENCE.md §6](ACADEMY_API_REFERENCE.md) (data-hygiene only, not the normal remove flow) |
