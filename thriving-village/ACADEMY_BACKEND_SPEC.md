# Thriving Village Academy — Backend Specification

**Scope:** This document covers the **Academy** (the cohort-based learning platform) **only** — not the main Thriving Village marketing site, job board, contests, or shop. It is the backend handoff for everything the Academy frontend needs.

**Status of the frontend:** The Academy is a finished **frontend skin** (Next.js 16, App Router, React 19). It has **no backend** — every piece of state lives in the browser (`localStorage` key `tv-academy-state-v4`) and all data is mocked in [`src/lib/cohort.ts`](src/lib/cohort.ts). The progression/business logic is implemented client-side in [`src/components/academy/CohortProvider.tsx`](src/components/academy/CohortProvider.tsx). **Your job is to replace all of that with real APIs, auth, and a database.** Field names below match the frontend types exactly so you can map them directly.

**Where the Academy lives:** routes under `/academy/*`. Intended to run on its own subdomain, e.g. `academy.thrivingvillage.us`, with its **own authentication** separate from the main site (no shared nav, no cross-links).

---

## 1. Roles & Auth

Four roles, each with its own scoped experience. Authentication is **separate from the main site**.

| Role | Who | Sees |
|------|-----|------|
| **Student** | Enrolled learner | Their enrolled courses, daily lessons, their own submissions/progress |
| **Facilitator** | Runs cohorts | **Only the cohorts/courses they facilitate** — roster, curriculum, rollout, gate, teams, sessions |
| **Judge** | Rates work | An **anonymized** queue of submissions. Never sees identities, cohorts, or other judges' scores |
| **Admin** | Platform staff | Everything — catalogue, materials, cohorts, all data |

**Requirements**
- Email/password sign-in (frontend already has the screen at `/academy`). Add real auth (sessions/JWT), password reset, etc.
- Role is assigned per user; a user could in principle hold more than one role, but treat them as distinct logins for now.
- **Facilitator scoping is a hard rule:** every facilitator endpoint must filter to cohorts where `cohort.facilitatorId == currentUser.id`. A facilitator must not be able to read/write another facilitator's cohort, roster, or students.
- **Judge anonymity is a hard rule** (see §7).

---

## 2. Domain Model

These are the core entities. Types mirror the frontend (`src/lib/cohort.ts`). Use whatever IDs you prefer (frontend currently uses slug strings like `frontend-development`).

### Category
```
Category { id, name, blurb }
```
Five seeded categories: **AI & Data, Creative & Design, Marketing, Development, Entrepreneurship**.

### Course (catalogue)
```
Course {
  id, categoryId, title,
  months: int,            // 3–6, course duration
  certificate: bool,      // professional tracks award a certificate on completion
  weeksTotal: int,        // derived in UI as months*4; make it a real column
  daysTotal: int          // weeksTotal * 7
}
```
~21 courses across the 5 categories (full list seeded in `CATEGORIES` in `cohort.ts`).

### Cohort
A scheduled run of a course, owned by one facilitator.
```
Cohort {
  id, courseId, name,          // e.g. "Cohort 7"
  facilitatorId,
  weeksTotal, daysTotal,
  startDate,
  status: "Enrolling" | "Running" | "Completed",
  releasedWeek: int            // highest week auto-rolled-out so far (see §5)
}
```

### User / Student profile
```
User { id, name, email, whatsapp, role }
```
- `email` and `whatsapp` are **shared with teammates** for group assignments (see §9). Currently the frontend generates these (`studentEmail`, `studentWhatsapp`); they must be real, stored fields.

### Enrollment (student ↔ cohort)
```
Enrollment {
  id, userId, cohortId,
  status: "In progress" | "Starting soon" | "Completed",
  // progression state — see §5
  currentDay: int,             // furthest day reached ("today")
  submittedDays: int[],        // days whose task is submitted
  earlyAccessRequested: bool,
  earlyWeeks: int[]            // weeks unlocked early by the facilitator
}
```
A student can have **multiple** enrollments and chooses one before entering the daily screen.

### Lesson / Day material
The unit of curriculum is the **day** (one lesson + one task). Lesson titles/tasks are currently generated; **material is admin-authored** and overrides the default.
```
Material {
  courseId, day: int,          // unique per (courseId, day)
  videoUrl: string | null,     // e.g. YouTube/Vimeo link
  text: string | null,         // written lesson / transcript
  // task + docs can also become editable fields
  task: string,
  taskDetail: string,
  docs: { label, href }[]
}
```
Keyed in the frontend as `${courseId}:${day}`. **Only Admin can write; Facilitator & Student read.**

### Submission
```
Submission {
  id, enrollmentId (→ userId + cohortId + courseId),
  day: int, week: int, task: string,
  url: string,                 // student pastes a link to their work
  submittedAt,
  rated: bool
}
```

### Judgment (a judge's rating of a submission)
```
Judgment {
  id, submissionId, judgeId,
  scores: { brief: 1-5, craft: 1-5, originality: 1-5 },
  average: number,
  feedback: string,
  createdAt
}
```
Scoring criteria are fixed (`SCORE_CRITERIA`): **Brief met**, **Craft & quality**, **Originality**.

### LiveSession (call / workshop)
```
LiveSession {
  id, cohortId, title,
  type: "Live call" | "Workshop",
  day: string, time: string,   // human labels for now; consider real datetime
  host: string,
  link: string | null          // meeting URL (Zoom/Meet) students join
}
```

### PerformanceThreshold (per cohort)
```
Threshold {
  cohortId,
  minCompletion: int,          // % of expected pace required to clear a checkpoint
  checkWeeks: int[]            // which weeks are checkpoints ("check dates")
}
```
Default `{ minCompletion: 60, checkWeeks: [4, 8] }` — but **must be settable per cohort by the facilitator**, not hardcoded.

### Cohort membership flags (per cohort)
- `removed` — students moved to the **bin** (no longer on the roster; restorable).
- `shortlist` — students the facilitator "selected" / flagged as top talent.

### Team (group assignment)
```
Team { id, cohortId, assignmentId, memberUserIds: string[] }
GroupAssignment { id, cohortId, week, title }
```
Teams are formed by chunking the active roster into groups of N (`teamSize`).

---

## 3. Curriculum & Materials

- **Admin** authors per-day material: a **video link** + **lesson text** (and ideally task/docs). Endpoint must be admin-only.
- **Facilitator** sees the curriculum **read-only**, scoped to their courses (course manager → weeks → days → lesson page).
- **Student** consumes it: the day view shows the video link as a "Watch lesson" action and the text as the lesson notes. If no material is authored, the frontend falls back to a generated placeholder — backend should return `null`/empty and let the client decide, or return the default.

**Endpoints (suggested)**
```
GET  /courses/:courseId/days/:day/material        # student, facilitator, admin
PUT  /courses/:courseId/days/:day/material        # admin only  { videoUrl, text, task, taskDetail, docs }
DELETE /courses/:courseId/days/:day/material      # admin only
GET  /courses/:courseId/curriculum                # full outline (weeks → days)
```

---

## 4. Student daily flow & submissions

The student screen = a 7-day strip (current week) + today's work (video, notes, docs, task, submit box).

- **Submit a task:** student pastes a URL.
  ```
  POST /enrollments/:id/submissions   { day, url }
  ```
  On success the server applies the **daily gate** (§5) and returns the updated enrollment progression.
- A day can be reviewed read-only after submission. Past submissions and their URLs should be retrievable.
  ```
  GET /enrollments/:id/submissions
  ```

---

## 5. Progression engine (the heart of the system)

All of this is currently in `CohortProvider.tsx` and must move server-side. Definitions: `weekOf(day) = ceil(day/7)`, `DAYS_PER_WEEK = 7`, a week is "available" if `week <= cohort.releasedWeek` **or** `week ∈ enrollment.earlyWeeks`.

1. **Daily gate.** Submitting day *d* adds *d* to `submittedDays`. If the next day's week is available, `currentDay` advances to *d+1*. Otherwise the student is **"caught up"** (finished everything released) and waits.

2. **Weekly auto-rollout.** Each cohort exposes weeks on a schedule. `releasedWeek` increments automatically (e.g. a **weekly cron** per cohort, or computed from `startDate`). When a new week is released, any caught-up student auto-advances into it.
   ```
   POST /cohorts/:id/rollout-next-week     # facilitator (manual trigger) + scheduled job
   ```

3. **Early access.** A caught-up student who finishes ahead can request the next week early; the facilitator reviews their work and grants it.
   ```
   POST  /enrollments/:id/early-access/request          # student
   GET   /cohorts/:id/early-access-requests             # facilitator (their cohort only)
   POST  /enrollments/:id/early-access/grant            # facilitator → adds releasedWeek+1 to earlyWeeks, advances student
   ```

4. **Performance gate / checkpoints.** At each `checkWeeks` checkpoint, the facilitator evaluates each student:
   `completion% = round(dayReached / (releasedWeek * 7) * 100)`; a student **meets the bar** if `completion% >= minCompletion`.
   Below the bar → can be **flagged**, **removed (binned)**, or **bulk-removed**.
   ```
   GET   /cohorts/:id/threshold
   PUT   /cohorts/:id/threshold            { minCompletion, checkWeeks }
   POST  /cohorts/:id/students/:uid/remove          # to bin
   POST  /cohorts/:id/students/:uid/restore         # from bin
   POST  /cohorts/:id/students/remove-bulk          { userIds: [] }   # mass remove
   ```

5. **Milestone (cosmetic).** ~33% (around day 30 of 90) is surfaced subtly. No hard logic; a computed flag is enough.

6. **Certificate.** On course completion, professional tracks (`course.certificate == true`) issue a certificate. Define issuance + storage + a verifiable record.

---

## 6. Facilitator

Everything here is **scoped to the facilitator's own cohorts**.
```
GET  /facilitator/cohorts                     # cohorts they run
GET  /cohorts/:id/roster                      # students + dayReached, standing, lastActive
GET  /cohorts/:id/students/:uid               # profile: stats, submissions, judgments (see below)
GET  /cohorts/:id/top-rated                   # roster sorted by avg judge score
POST /cohorts/:id/students/:uid/shortlist     # toggle "select"
```
- **Student profile** must return the student's **stats** (progress, week, # submitted, avg judge score), their **submitted assignments** (with links), and the **judgments** their work received (scores + feedback). The facilitator/admin *can* see the student↔submission↔judgment mapping even though judges cannot.
- **Standing** (`on-track | behind | at-risk`) can be derived from pace vs. the cohort's expected day, or stored.

**Calls & workshops**
```
GET  /cohorts/:id/sessions
POST /cohorts/:id/sessions     { title, type, day, time, link }
```

---

## 7. Judge (anonymity is mandatory)

```
GET  /judge/queue                 # pending submissions, ANONYMIZED
POST /judge/submissions/:id/rate  { scores: {brief, craft, originality}, feedback }
```
**Hard rules — enforce server-side, do not rely on the client:**
- The judge payload must expose **only** an anonymous handle (e.g. `Entry A12`), the course title, the task, the week, and the work URL. **Never** the student's name, email, cohort, or any identifying field.
- A judge must **never** see other judges' scores or who else has rated an item.
- The platform still stores the real `submissionId → student` link (for §6 facilitator/admin views), but it must never be returned on judge endpoints.
- Consider assigning each judge a per-submission anonymous handle so handles don't leak identity across items.

---

## 8. Admin

Full CRUD + platform-wide reads.
```
# Catalogue
GET/POST/PUT/DELETE /categories, /courses
PUT  /courses/:id/days/:day/material          # material authoring (see §3)

# Cohorts
GET/POST/PUT /cohorts                          # create, assign facilitator, set schedule
GET  /admin/overview                           # platform stats: # categories, courses, cohorts, students
GET  /admin/top-rated                          # best-rated students platform-wide
GET  /admin/activity                           # recent activity feed
```
Admin overview currently shows counts + an activity feed + a "top-rated talent" list. Activity feed implies an **audit/event log** (enrollments, approvals, rollouts, ratings, gate actions).

---

## 9. Teams (group assignments)

For assignments that need teammates:
```
POST /cohorts/:id/teams/match     { teamSize }     # facilitator: chunk active roster into teams of N
DELETE /cohorts/:id/teams                          # clear
GET  /cohorts/:id/teams                            # facilitator/admin: all teams + members
GET  /enrollments/:id/team                         # student: their teammates
```
- When matched, a student sees teammates' **name, email, and WhatsApp number only** — nothing else — so they can self-organize and deliver the project.
- Removed (binned) students are excluded from matching.

---

## 10. Permissions matrix (summary)

| Capability | Student | Facilitator (own cohorts) | Judge | Admin |
|---|---|---|---|---|
| View own enrollments / daily lessons | ✅ | — | — | ✅ |
| Submit task | ✅ | — | — | — |
| Request early access | ✅ | — | — | — |
| View teammates' contact | ✅ (matched) | ✅ | — | ✅ |
| View roster / student profiles | — | ✅ | — | ✅ |
| Grant early access / roll out week | — | ✅ | — | ✅ |
| Set threshold / flag / remove / shortlist | — | ✅ | — | ✅ |
| Match teams | — | ✅ | — | ✅ |
| Schedule sessions | — | ✅ | — | ✅ |
| Read curriculum | ✅ (their course) | ✅ (their courses) | — | ✅ |
| **Author materials** | ❌ | ❌ (read-only) | — | ✅ |
| Rate submissions (anonymized) | — | — | ✅ | — |
| See judge identities / cross-scores | ❌ | ❌ | ❌ | (mapping only, server-side) |
| Manage catalogue / cohorts | — | — | — | ✅ |

---

## 11. Cross-cutting

- **Notifications** (nice-to-have): student early-access request → facilitator; week rolled out / early access granted → student; new session scheduled → cohort; gate flag → student.
- **Persistence:** everything in the frontend `localStorage` blob (`tv-academy-state-v4`) becomes server state. There is no offline requirement.
- **Submissions are URLs only** today (no file upload). If you want hosted uploads, add storage.
- **Out of scope for the Academy:** payments, the job board, contests, the shop, and the main marketing site. Community links (WhatsApp/YouTube) are external placeholders.

---

## 12. Where to read the source of truth

- **Data shapes & seed data:** [`src/lib/cohort.ts`](src/lib/cohort.ts)
- **Progression / business logic (to port to the server):** [`src/components/academy/CohortProvider.tsx`](src/components/academy/CohortProvider.tsx)
- **Screens (what each role sees / calls):** `src/app/academy/**`

Field names and enums in this document match those files. When in doubt, the frontend types are authoritative for shape; this document is authoritative for **rules and permissions**.
