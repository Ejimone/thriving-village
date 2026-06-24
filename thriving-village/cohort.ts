/* ============================================================
   Mock data for the cohort-based learning platform.
   Frontend skin only — no backend. All progression/lock state
   is held in local React state (see CohortProvider).

   The platform layers cohort delivery on top of Thriving Village
   courses: students move through a course one day at a time, a
   facilitator runs the cohort, judges rate work anonymously, and
   admins manage the catalogue platform-wide.
   ============================================================ */

/* ---- Course catalogue: five categories ---- */

export type CatalogCourse = {
  id: string;
  title: string;
  /** Roughly how long the course runs. Courses span 3–6 months. */
  months: number;
  /** Professional tracks award a certificate on completion. */
  certificate: boolean;
};

export type Category = {
  id: string;
  name: string;
  blurb: string;
  courses: CatalogCourse[];
};

const c = (title: string, months: number, certificate = true): CatalogCourse => ({
  id: title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, ""),
  title,
  months,
  certificate,
});

export const CATEGORIES: Category[] = [
  {
    id: "ai-data",
    name: "AI & Data",
    blurb: "Turn raw data into decisions, and learn the craft behind modern AI.",
    courses: [c("Data Analytics", 4), c("Data Science", 6)],
  },
  {
    id: "creative-design",
    name: "Creative & Design",
    blurb: "From the first mark to a full visual system — the craft of making things look right.",
    courses: [
      c("Graphic Design", 4),
      c("UI/UX Design", 5),
      c("Video Editing", 3),
      c("Motion Graphics & Animation", 5),
      c("Photography", 3),
      c("Brand & Visual Identity Design", 4),
    ],
  },
  {
    id: "marketing",
    name: "Marketing",
    blurb: "Reach people, hold their attention, and turn it into growth.",
    courses: [
      c("Digital Marketing", 4),
      c("Content Marketing & Writing", 3),
      c("Social Media Marketing", 3),
    ],
  },
  {
    id: "development",
    name: "Development",
    blurb: "Build for the web, for mobile, and everything that holds it together.",
    courses: [
      c("Frontend Development", 3),
      c("Backend Development", 4),
      c("Mobile Development", 4),
      c("Full-stack Development", 6),
      c("E-commerce Development", 4),
      c("Cybersecurity", 5),
    ],
  },
  {
    id: "entrepreneurship",
    name: "Entrepreneurship",
    blurb: "Start something, run it well, and put your name to your work.",
    courses: [
      c("Starting a Business", 3),
      c("Product Management", 4),
      c("Personal Branding & Freelancing", 3),
      c("Sales", 3),
    ],
  },
];

export const ALL_COURSES = CATEGORIES.flatMap((cat) =>
  cat.courses.map((co) => ({ ...co, category: cat.name, categoryId: cat.id })),
);

/* ============================================================
   THE ACTIVE COHORT
   One cohort is wired up in detail so every role has real screens.
   ============================================================ */

export const COHORT = {
  id: "frontend-c7",
  course: "Frontend Development",
  name: "Frontend Development — Cohort 7",
  facilitator: "Chidi Okafor",
  daysTotal: 90,
  weeksTotal: 13,
  startedAgo: "11 days ago",
};

/* The student we sign in as for the Student role. */
export const ME = {
  name: "Ada Okonkwo",
};

/* ---- Week structure ---- */
export const DAYS_PER_WEEK = 7;
export const weekOf = (day: number) => Math.ceil(day / DAYS_PER_WEEK);
export const dayInWeek = (day: number) => ((day - 1) % DAYS_PER_WEEK) + 1;
export const isWeekEnd = (day: number) =>
  dayInWeek(day) === DAYS_PER_WEEK || day === COHORT.daysTotal;
/** First absolute day number of a given week. */
export const weekStartDay = (week: number) => (week - 1) * DAYS_PER_WEEK + 1;

/** The week-4 performance gate and the ~33% milestone. */
export const GATE_WEEK = 4;
export const MILESTONE_DAY = 30; // ~33% of 90

/* ---- Day content (generated from week themes; faithful, compact) ---- */

type WeekTheme = { title: string; focus: string; docs: { label: string; href: string }[] };

const WEEK_THEMES: WeekTheme[] = [
  { title: "How the web works", focus: "the browser, HTTP, and your first pages", docs: [
    { label: "MDN — How the web works", href: "#" }, { label: "HTML elements reference", href: "#" } ] },
  { title: "Structure with HTML", focus: "semantic markup and accessible documents", docs: [
    { label: "MDN — HTML semantics", href: "#" }, { label: "WAI-ARIA basics", href: "#" } ] },
  { title: "Styling with CSS", focus: "the box model, layout, and the cascade", docs: [
    { label: "MDN — CSS box model", href: "#" }, { label: "Flexbox guide", href: "#" } ] },
  { title: "Responsive layouts", focus: "Grid, media queries, and mobile-first work", docs: [
    { label: "CSS Grid guide", href: "#" }, { label: "Responsive design patterns", href: "#" } ] },
  { title: "JavaScript foundations", focus: "values, functions, and control flow", docs: [
    { label: "MDN — JavaScript basics", href: "#" }, { label: "Modern JS reference", href: "#" } ] },
  { title: "The DOM & events", focus: "reading and changing the page with code", docs: [
    { label: "MDN — DOM introduction", href: "#" }, { label: "Event handling", href: "#" } ] },
  { title: "Async & fetching data", focus: "promises, async/await, and APIs", docs: [
    { label: "MDN — Using fetch", href: "#" }, { label: "Working with JSON", href: "#" } ] },
  { title: "Thinking in React", focus: "components, props, and JSX", docs: [
    { label: "React — Quick start", href: "#" }, { label: "Components and props", href: "#" } ] },
  { title: "State & interactivity", focus: "useState, events, and lifting state", docs: [
    { label: "React — Managing state", href: "#" }, { label: "Hooks reference", href: "#" } ] },
  { title: "Data & effects", focus: "useEffect, fetching, and rendering lists", docs: [
    { label: "React — Effects", href: "#" }, { label: "Fetching data patterns", href: "#" } ] },
  { title: "Routing & structure", focus: "pages, navigation, and project layout", docs: [
    { label: "Routing fundamentals", href: "#" }, { label: "Project structure", href: "#" } ] },
  { title: "Polish & accessibility", focus: "forms, performance, and a11y", docs: [
    { label: "Form best practices", href: "#" }, { label: "Web accessibility", href: "#" } ] },
  { title: "Your capstone project", focus: "shipping a portfolio-ready build", docs: [
    { label: "Deploying to the web", href: "#" }, { label: "Writing a project README", href: "#" } ] },
];

const LESSON_TYPES = ["Concepts", "Walkthrough", "Practice", "Build", "Apply", "Review", "Ship"];

const VIDEO_MINUTES = [14, 18, 22, 16, 20, 12, 9];

export type DayContent = {
  day: number;
  week: number;
  dayInWeek: number;
  theme: string;
  lessonType: string;
  title: string;
  videoDuration: string;
  material: string[];
  docs: { label: string; href: string }[];
  task: string;
  taskDetail: string;
};

/** Frontend has authored themes; other enrolled courses get a generic module. */
function themeFor(courseId: string | undefined, week: number): WeekTheme {
  if (!courseId || courseId === "frontend-development") {
    return WEEK_THEMES[Math.min(week, WEEK_THEMES.length) - 1];
  }
  const title = ALL_COURSES.find((c) => c.id === courseId)?.title ?? "Your course";
  return {
    title: `${title} · Module ${week}`,
    focus: `the week ${week} fundamentals of ${title.toLowerCase()}`,
    docs: [
      { label: `${title} reference`, href: "#" },
      { label: "Further reading", href: "#" },
    ],
  };
}

export function getDay(day: number, courseId?: string): DayContent {
  const week = weekOf(day);
  const theme = themeFor(courseId, week);
  const idx = dayInWeek(day) - 1;
  const lessonType = LESSON_TYPES[idx] ?? "Practice";
  return {
    day,
    week,
    dayInWeek: dayInWeek(day),
    theme: theme.title,
    lessonType,
    title: `${theme.title}: ${lessonType}`,
    videoDuration: `${VIDEO_MINUTES[idx] ?? 15} min`,
    material: [
      `Today builds on ${theme.focus}. Watch the lesson first, then read these notes to lock it in. Work alongside the video — the ideas stick faster when you build as you go.`,
      `We keep each day to one clear idea. Don't rush. When the task below feels doable on your own, you're ready to submit and move on to tomorrow.`,
    ],
    docs: theme.docs,
    task: `${lessonType} task — ${theme.title.toLowerCase()}`,
    taskDetail:
      lessonType === "Ship"
        ? `Put the week together into one small, working build. Push it somewhere live (or to a repo) and paste the link below.`
        : `Apply what you learned in a short exercise on ${theme.focus}. Build it, then paste a link to your work (CodeSandbox, a repo, or a deployed page).`,
  };
}

/* ============================================================
   FACILITATOR — cohort roster, health, approvals, gate
   ============================================================ */

export type StudentStanding = "on-track" | "behind" | "at-risk";

export type CohortStudent = {
  id: string;
  name: string;
  dayReached: number; // furthest day they've completed
  lastActive: string;
  standing: StudentStanding;
  /** Week-4 performance gate decision. */
  gate: "pending" | "passed" | "at-risk";
};

const mkStudent = (
  name: string,
  dayReached: number,
  lastActive: string,
  standing: StudentStanding,
  gate: CohortStudent["gate"] = "pending",
): CohortStudent => ({
  id: name.toLowerCase().replace(/\s+/g, "-"),
  name,
  dayReached,
  lastActive,
  standing,
  gate,
});

/** The signed-in student (Ada) leads the roster so cross-role state lines up. */
export const ROSTER: CohortStudent[] = [
  mkStudent("Ada Okonkwo", 11, "today", "on-track", "passed"),
  mkStudent("Emeka Balogun", 13, "today", "on-track", "passed"),
  mkStudent("Zainab Yusuf", 12, "2 hours ago", "on-track", "passed"),
  mkStudent("Tunde Adeyemi", 9, "yesterday", "behind", "at-risk"),
  mkStudent("Amara Eze", 14, "today", "on-track", "passed"),
  mkStudent("Chidi Nwosu", 11, "today", "on-track", "passed"),
  mkStudent("Ngozi Obi", 7, "3 days ago", "at-risk", "at-risk"),
  mkStudent("Bola Adesanya", 12, "today", "on-track", "passed"),
  mkStudent("Ifeanyi Eze", 10, "yesterday", "behind", "pending"),
  mkStudent("Funke Akin", 13, "today", "on-track", "passed"),
  mkStudent("Sade Bello", 11, "today", "on-track", "passed"),
  mkStudent("Kelechi Umeh", 8, "2 days ago", "behind", "at-risk"),
  mkStudent("Maryam Sani", 14, "today", "on-track", "passed"),
  mkStudent("Obi Anozie", 12, "today", "on-track", "passed"),
];

export const STANDING_LABEL: Record<StudentStanding, string> = {
  "on-track": "On track",
  behind: "Behind",
  "at-risk": "At risk",
};

/** The signed-in student (Ada, row 0) is the live one. */
export const ME_STUDENT_ID = ROSTER[0].id;

/**
 * Roster with Ada's progress synced to live state and removed (binned)
 * students filtered out. Used across facilitator screens.
 */
export function liveRoster(
  adaDayReached: number,
  removed: string[] = [],
): CohortStudent[] {
  return ROSTER.map((s) =>
    s.id === ME_STUDENT_ID
      ? { ...s, dayReached: Math.max(0, adaDayReached), lastActive: "today" }
      : s,
  ).filter((s) => !removed.includes(s.id));
}

/* ---- Live calls & workshops (facilitator schedule + student upcoming) ---- */
export type LiveSession = {
  id: string;
  title: string;
  type: "Live call" | "Workshop";
  day: string; // human label
  time: string;
  host: string;
  /** Meeting link (Zoom/Meet/etc.) students join from. */
  link?: string;
};

export const SESSIONS: LiveSession[] = [
  { id: "s1", title: "Week 2 group call", type: "Live call", day: "Tomorrow", time: "5:00 PM WAT", host: "Chidi Okafor", link: "https://meet.google.com/abc-defg-hij" },
  { id: "s2", title: "CSS layout workshop", type: "Workshop", day: "Thursday", time: "6:00 PM WAT", host: "Chidi Okafor", link: "https://zoom.us/j/123456789" },
  { id: "s3", title: "Office hours", type: "Live call", day: "Saturday", time: "11:00 AM WAT", host: "Chidi Okafor" },
  { id: "s4", title: "Week 3 kickoff", type: "Live call", day: "Next Monday", time: "5:00 PM WAT", host: "Chidi Okafor", link: "https://meet.google.com/xyz-week3-kick" },
];

/* ============================================================
   STUDENT ENROLLMENTS
   A student can be enrolled in several courses. On sign-in they choose
   one before reaching the day-by-day screen. The Frontend cohort is the
   fully-detailed one (matches COHORT); the others are lighter but live.
   ============================================================ */

export type Enrollment = {
  courseId: string;
  title: string;
  category: string;
  cohortName: string;
  facilitator: string;
  daysTotal: number;
  weeksTotal: number;
  /** Furthest day this student has reached in the course (their "today"). */
  startDay: number;
  /** Weeks auto-rolled-out by the cohort schedule. */
  releasedWeek: number;
  status: "In progress" | "Starting soon" | "Completed";
};

export const MY_ENROLLMENTS: Enrollment[] = [
  {
    courseId: "frontend-development",
    title: "Frontend Development",
    category: "Development",
    cohortName: "Cohort 7",
    facilitator: "Chidi Okafor",
    daysTotal: 90,
    weeksTotal: 13,
    startDay: 12,
    releasedWeek: 2,
    status: "In progress",
  },
  {
    courseId: "ui-ux-design",
    title: "UI/UX Design",
    category: "Creative & Design",
    cohortName: "Cohort 3",
    facilitator: "Zainab Yusuf",
    daysTotal: 100,
    weeksTotal: 20,
    startDay: 40,
    releasedWeek: 6,
    status: "In progress",
  },
  {
    courseId: "digital-marketing",
    title: "Digital Marketing",
    category: "Marketing",
    cohortName: "Cohort 2",
    facilitator: "Amara Eze",
    daysTotal: 80,
    weeksTotal: 16,
    startDay: 1,
    releasedWeek: 1,
    status: "Starting soon",
  },
];

export const getEnrollment = (courseId: string) =>
  MY_ENROLLMENTS.find((e) => e.courseId === courseId);

/* ============================================================
   PERFORMANCE THRESHOLD (facilitator-set, not hardcoded per check)
   ============================================================ */

export type Threshold = {
  /** Minimum completion-of-expected-pace to clear a checkpoint, as a %. */
  minCompletion: number;
  /** Which weeks are performance checkpoints ("check dates"). */
  checkWeeks: number[];
};

export const DEFAULT_THRESHOLD: Threshold = {
  minCompletion: 60,
  checkWeeks: [4, 8],
};

/** Completion against the cohort's expected pace (released day) for a checkpoint. */
export const paceCompletion = (dayReached: number, releasedDay: number) =>
  Math.min(100, Math.round((dayReached / releasedDay) * 100));

/* ============================================================
   JUDGE — anonymized submission queue
   Judges never see who submitted, the cohort, or other judges' scores.
   ============================================================ */

export type JudgeSubmission = {
  id: string; // anonymous handle, e.g. "Entry A12"
  course: string;
  task: string;
  week: number;
  submittedAgo: string;
  url: string;
  note: string; // the (anonymous) maker's note on their work
};

export const JUDGE_QUEUE: JudgeSubmission[] = [
  { id: "Entry A12", course: "Frontend Development", task: "Responsive layouts — Build", week: 4, submittedAgo: "20 min ago", url: "https://example.com/work/a12", note: "Mobile-first, used Grid for the gallery. Tried to keep the breakpoints minimal." },
  { id: "Entry B07", course: "UI/UX Design", task: "Wireframe to prototype", week: 6, submittedAgo: "1 hour ago", url: "https://example.com/work/b07", note: "Three screens, focused on the checkout flow. Feedback on the empty states welcome." },
  { id: "Entry C31", course: "Graphic Design", task: "Logo system", week: 5, submittedAgo: "2 hours ago", url: "https://example.com/work/c31", note: "Black and white mark with one accent. Included a sign mockup." },
  { id: "Entry D18", course: "Data Analytics", task: "Dashboard build", week: 7, submittedAgo: "3 hours ago", url: "https://example.com/work/d18", note: "Cleaned the dataset first, then built three views. Notes are in the repo." },
  { id: "Entry E44", course: "Frontend Development", task: "State & interactivity — Build", week: 9, submittedAgo: "4 hours ago", url: "https://example.com/work/e44", note: "A small todo app with filters. Lifted state up where it made sense." },
  { id: "Entry F09", course: "Content Marketing & Writing", task: "Long-form article", week: 3, submittedAgo: "5 hours ago", url: "https://example.com/work/f09", note: "1,200 words on a clear structure. Edited it down twice." },
  { id: "Entry G22", course: "Motion Graphics & Animation", task: "Logo animation", week: 8, submittedAgo: "6 hours ago", url: "https://example.com/work/g22", note: "Six-second loop. Kept the easing soft and the palette neutral." },
  { id: "Entry H56", course: "Mobile Development", task: "List & detail screens", week: 6, submittedAgo: "yesterday", url: "https://example.com/work/h56", note: "Two screens with navigation between them. Handled the loading state." },
];

export const SCORE_CRITERIA = [
  { id: "brief", label: "Brief met", hint: "Did the work do what the task asked?" },
  { id: "craft", label: "Craft & quality", hint: "How well is it executed?" },
  { id: "originality", label: "Originality", hint: "Is there a point of view?" },
];

/* ---- Per-student work + judgments (facilitator profile view) ----
   Judges rate anonymously; the platform knows whose work it is, so a
   facilitator can see a student's submissions and the scores they drew. */

export type StudentSubmission = {
  day: number;
  task: string;
  url: string;
  submittedAgo: string;
  rated: boolean;
};

export type Judgment = {
  entry: string; // the anonymous handle the judge saw
  task: string;
  scores: Record<string, number>; // by SCORE_CRITERIA id
  average: number;
  feedback: string;
};

// Tiny deterministic seed from a string, so each student's mock data is stable.
const seedFrom = (s: string) =>
  s.split("").reduce((a, ch) => (a * 31 + ch.charCodeAt(0)) % 9973, 7);

const AGO = ["today", "yesterday", "2 days ago", "3 days ago", "4 days ago", "5 days ago"];
const FEEDBACK = [
  "Solid grasp of the brief. Tighten the spacing next time.",
  "Clear point of view — push the type hierarchy further.",
  "Clean execution. Watch the edge cases on smaller screens.",
  "Good instincts. The structure could be a touch simpler.",
  "Strong work overall; the finish lifts it above the rest.",
];

export function studentSubmissions(s: CohortStudent): StudentSubmission[] {
  const count = Math.min(6, Math.max(1, s.dayReached));
  return Array.from({ length: count }, (_, i) => {
    const day = s.dayReached - i;
    const d = getDay(day, "frontend-development");
    return {
      day,
      task: d.title,
      url: `https://example.com/${s.id}/day-${day}`,
      submittedAgo: AGO[i] ?? `${i} days ago`,
      rated: (seedFrom(s.id) + i) % 3 !== 0, // most are rated
    };
  });
}

export function studentJudgments(s: CohortStudent): Judgment[] {
  const seed = seedFrom(s.id);
  return studentSubmissions(s)
    .filter((sub) => sub.rated)
    .slice(0, 3)
    .map((sub, i) => {
      // Stable-ish scores in 3..5, nudged by standing.
      const base = s.standing === "on-track" ? 4 : s.standing === "behind" ? 3 : 3;
      const scores = {
        brief: Math.min(5, base + ((seed + i) % 2)),
        craft: Math.min(5, base + ((seed + i + 1) % 2)),
        originality: Math.min(5, base + ((seed + i + 2) % 2)),
      };
      const vals = Object.values(scores);
      return {
        entry: `Entry ${s.id.slice(0, 1).toUpperCase()}${(seed + i * 7) % 90}`,
        task: sub.task,
        scores,
        average: Math.round((vals.reduce((a, b) => a + b, 0) / vals.length) * 10) / 10,
        feedback: FEEDBACK[(seed + i) % FEEDBACK.length],
      };
    });
}

/** Average judge score across a student's rated work (0 when none). */
export const studentAvgScore = (s: CohortStudent): number => {
  const js = studentJudgments(s);
  if (!js.length) return 0;
  return Math.round((js.reduce((a, j) => a + j.average, 0) / js.length) * 10) / 10;
};

export const getStudent = (id: string) => ROSTER.find((s) => s.id === id);

/* ---- Contact details (shared with teammates for group assignments) ---- */

export const studentEmail = (s: CohortStudent): string =>
  `${s.name.toLowerCase().replace(/\s+/g, ".")}@mail.thrivingvillage.us`;

export const studentWhatsapp = (s: CohortStudent): string => {
  const n = seedFrom(s.id);
  const a = 700 + (n % 200);
  const b = String((n * 7) % 1000).padStart(3, "0");
  const cc = String((n * 13) % 10000).padStart(4, "0");
  return `+234 ${a} ${b} ${cc}`;
};

/** Digits only, for a wa.me link. */
export const whatsappLink = (s: CohortStudent): string =>
  `https://wa.me/234${studentWhatsapp(s).replace(/[^0-9]/g, "").slice(3)}`;

/** The current group assignment teams form around. */
export const GROUP_ASSIGNMENT = {
  week: 6,
  title: "Week 6 group project",
};

/* ============================================================
   ADMIN — platform-wide overview
   ============================================================ */

export const ADMIN_STATS = [
  { label: "Categories", value: "5" },
  { label: "Courses", value: String(ALL_COURSES.length) },
  { label: "Active cohorts", value: "9" },
  { label: "Students enrolled", value: "1,284" },
];

export type AdminCohort = {
  id: string;
  courseId: string;
  course: string;
  name: string;
  facilitator: string;
  students: number;
  week: number;
  weeksTotal: number;
  status: "Enrolling" | "Running" | "Completed";
};

export const ADMIN_COHORTS: AdminCohort[] = [
  { id: "fe-7", courseId: "frontend-development", course: "Frontend Development", name: "Cohort 7", facilitator: "Chidi Okafor", students: 14, week: 2, weeksTotal: 13, status: "Running" },
  { id: "be-3", courseId: "backend-development", course: "Backend Development", name: "Cohort 3", facilitator: "Chidi Okafor", students: 17, week: 5, weeksTotal: 16, status: "Running" },
  { id: "uiux-3", courseId: "ui-ux-design", course: "UI/UX Design", name: "Cohort 3", facilitator: "Zainab Yusuf", students: 22, week: 6, weeksTotal: 20, status: "Running" },
  { id: "da-4", courseId: "data-analytics", course: "Data Analytics", name: "Cohort 4", facilitator: "Ifeoma Chukwu", students: 31, week: 7, weeksTotal: 16, status: "Running" },
  { id: "gd-2", courseId: "graphic-design", course: "Graphic Design", name: "Cohort 2", facilitator: "Emeka Balogun", students: 18, week: 5, weeksTotal: 16, status: "Running" },
  { id: "fs-1", courseId: "full-stack-development", course: "Full-stack Development", name: "Cohort 1", facilitator: "Tunde Adeyemi", students: 12, week: 1, weeksTotal: 24, status: "Running" },
  { id: "cm-5", courseId: "content-marketing-writing", course: "Content Marketing & Writing", name: "Cohort 5", facilitator: "Amara Eze", students: 26, week: 12, weeksTotal: 12, status: "Completed" },
  { id: "mob-2", courseId: "mobile-development", course: "Mobile Development", name: "Cohort 2", facilitator: "Chidi Nwosu", students: 0, week: 0, weeksTotal: 16, status: "Enrolling" },
  { id: "sec-1", courseId: "cybersecurity", course: "Cybersecurity", name: "Cohort 1", facilitator: "Maryam Sani", students: 0, week: 0, weeksTotal: 20, status: "Enrolling" },
  { id: "pm-3", courseId: "product-management", course: "Product Management", name: "Cohort 3", facilitator: "Obi Anozie", students: 19, week: 8, weeksTotal: 16, status: "Running" },
];

/* ---- The signed-in facilitator, scoped to the courses they run ---- */
export const FACILITATOR = { name: "Chidi Okafor" };

/** Cohorts this facilitator runs. */
export const facilitatorCohorts = (name: string = FACILITATOR.name) =>
  ADMIN_COHORTS.filter((c) => c.facilitator === name);

/** Distinct courses this facilitator teaches (id + title). */
export const facilitatorCourses = (name: string = FACILITATOR.name) => {
  const seen = new Set<string>();
  const out: { courseId: string; title: string; weeksTotal: number }[] = [];
  for (const c of facilitatorCohorts(name)) {
    if (seen.has(c.courseId)) continue;
    seen.add(c.courseId);
    out.push({ courseId: c.courseId, title: c.course, weeksTotal: c.weeksTotal });
  }
  return out;
};

export const ADMIN_ACTIVITY = [
  { who: "Zainab Yusuf", what: "approved week 5 for UI/UX Cohort 3", when: "8m ago" },
  { who: "System", what: "opened enrollment for Cybersecurity Cohort 1", when: "40m ago" },
  { who: "Ifeoma Chukwu", what: "scheduled a workshop for Data Analytics Cohort 4", when: "1h ago" },
  { who: "A judge", what: "rated 6 submissions", when: "2h ago" },
  { who: "Chidi Okafor", what: "flagged 2 students at the week-4 gate", when: "3h ago" },
];

/* ---- Community links (placeholders) ---- */
export const COMMUNITY = {
  whatsapp: "https://chat.whatsapp.com/",
  youtube: "https://youtube.com/",
};

/* ---- Roles ---- */
export type Role = "student" | "facilitator" | "judge" | "admin";

export const ROLES: { id: Role; label: string; blurb: string }[] = [
  { id: "student", label: "Student", blurb: "Learn and submit work" },
  { id: "facilitator", label: "Facilitator", blurb: "Run the cohort" },
  { id: "judge", label: "Judge", blurb: "Rate work anonymously" },
  { id: "admin", label: "Admin", blurb: "Manage the platform" },
];
