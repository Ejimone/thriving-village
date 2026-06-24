"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import {
  DEFAULT_THRESHOLD,
  MY_ENROLLMENTS,
  ROSTER,
  getEnrollment,
  weekOf,
  type Enrollment,
  type Threshold,
} from "@/lib/cohort";

/* ============================================================
   Academy progression state.

   Holds, in local state (persisted to localStorage):
   - per-course student progress (a student is enrolled in several)
   - the weekly auto-rollout + early-access mechanic
   - facilitator-set threshold, the cohort "bin" (removed students),
     and a shortlist ("select some")

   WEEKLY MODEL
   Weeks roll out automatically on the cohort schedule (`releasedWeek`).
   A student does one day at a time within released weeks. If they finish
   the released weeks early, the next week stays locked until either the
   schedule rolls it out, OR they request early access and the facilitator
   grants it.
   ============================================================ */

const FRONTEND_ID = "frontend-development";

type CourseProgress = {
  currentDay: number;
  submitted: number[];
  releasedWeek: number;
  earlyRequested: boolean;
  earlyWeeks: number[];
};

/** Admin-authored course material for a given day. */
export type Material = { text?: string; video?: string };

type State = {
  byCourse: Record<string, CourseProgress>;
  threshold: Threshold;
  removed: string[];
  shortlist: string[];
  /** Teams for the current group assignment (each team is a list of student ids). */
  teams: string[][];
  teamSize: number;
  /** Course materials keyed by `${courseId}:${day}`. Authored by admin only. */
  materials: Record<string, Material>;
};

const materialKey = (courseId: string, day: number) => `${courseId}:${day}`;

const chunk = <T,>(arr: T[], size: number): T[][] => {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
};

type CourseView = CourseProgress & {
  enrollment: Enrollment;
  isWeekAvailable: (week: number) => boolean;
  /** Finished everything released; waiting on the schedule or an early grant. */
  isCaughtUp: boolean;
  progressPct: number;
  isSubmitted: (day: number) => boolean;
};

type ContextValue = {
  enrollments: Enrollment[];
  // student
  course: (courseId: string) => CourseView;
  submitToday: (courseId: string) => void;
  requestEarlyAccess: (courseId: string) => void;
  // facilitator
  threshold: Threshold;
  setThreshold: (t: Threshold) => void;
  removed: string[];
  removeStudent: (id: string) => void;
  restoreStudent: (id: string) => void;
  isRemoved: (id: string) => boolean;
  removeStudents: (ids: string[]) => void;
  shortlist: string[];
  toggleShortlist: (id: string) => void;
  isShortlisted: (id: string) => boolean;
  rolloutNextWeek: (courseId: string) => void;
  grantEarlyAccess: (courseId: string) => void;
  // teams
  teams: string[][];
  teamSize: number;
  matchTeams: (size: number) => void;
  clearTeams: () => void;
  /** Teammate ids for a student (excludes the student), or null if unmatched. */
  teamOf: (id: string) => string[] | null;
  // course materials (admin authors; everyone else reads)
  getMaterial: (courseId: string, day: number) => Material | null;
  setMaterial: (courseId: string, day: number, mat: Material) => void;
  /** Live early-access request from the signed-in student (Ada), for the facilitator. */
  frontendEarlyRequested: boolean;
  reset: () => void;
};

const initCourse = (e: Enrollment): CourseProgress => ({
  currentDay: e.startDay,
  submitted: Array.from({ length: Math.max(0, e.startDay - 1) }, (_, i) => i + 1),
  releasedWeek: e.releasedWeek,
  earlyRequested: false,
  earlyWeeks: [],
});

const INITIAL: State = {
  byCourse: Object.fromEntries(MY_ENROLLMENTS.map((e) => [e.courseId, initCourse(e)])),
  threshold: DEFAULT_THRESHOLD,
  removed: [],
  shortlist: [],
  teams: chunk(ROSTER.map((s) => s.id), 3),
  teamSize: 3,
  // Seed one authored example so the material flow is visible out of the box.
  materials: {
    "frontend-development:12": {
      text: "HTML gives a page its meaning, not just its look. Use elements for what they are — a <nav> for navigation, a <button> for actions, headings in order. Screen readers and search engines rely on that structure.\n\nFor today's task, mark up a small profile card using only semantic elements. No <div> soup. Keep it clean and readable.",
      video: "https://www.youtube.com/watch?v=kUMe1FH4CHE",
    },
  },
};

const STORAGE_KEY = "tv-academy-state-v4";

const isAvailable = (p: CourseProgress, week: number) =>
  week <= p.releasedWeek || p.earlyWeeks.includes(week);

/** Advance currentDay past submitted days into any newly-available week. */
function normalize(p: CourseProgress, daysTotal: number): CourseProgress {
  let currentDay = p.currentDay;
  while (
    currentDay < daysTotal &&
    p.submitted.includes(currentDay) &&
    isAvailable(p, weekOf(currentDay + 1))
  ) {
    currentDay += 1;
  }
  return { ...p, currentDay };
}

const Ctx = createContext<ContextValue | null>(null);

export function CohortProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<State>(INITIAL);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      // Hydration-safe load: server renders INITIAL, client adopts saved state.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (raw) setState(JSON.parse(raw));
    } catch {
      /* ignore corrupt state */
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      /* storage unavailable; demo still works in-memory */
    }
  }, [state, hydrated]);

  const patchCourse = (courseId: string, fn: (p: CourseProgress) => CourseProgress) =>
    setState((s) => {
      const p = s.byCourse[courseId];
      if (!p) return s;
      const daysTotal = getEnrollment(courseId)?.daysTotal ?? 90;
      return {
        ...s,
        byCourse: { ...s.byCourse, [courseId]: normalize(fn(p), daysTotal) },
      };
    });

  const submitToday = (courseId: string) =>
    patchCourse(courseId, (p) => ({
      ...p,
      submitted: p.submitted.includes(p.currentDay)
        ? p.submitted
        : [...p.submitted, p.currentDay],
    }));

  const requestEarlyAccess = (courseId: string) =>
    patchCourse(courseId, (p) => ({ ...p, earlyRequested: true }));

  const grantEarlyAccess = (courseId: string) =>
    patchCourse(courseId, (p) => ({
      ...p,
      earlyRequested: false,
      earlyWeeks: [...new Set([...p.earlyWeeks, p.releasedWeek + 1])],
    }));

  const rolloutNextWeek = (courseId: string) =>
    patchCourse(courseId, (p) => {
      const weeksTotal = getEnrollment(courseId)?.weeksTotal ?? 13;
      return { ...p, releasedWeek: Math.min(weeksTotal, p.releasedWeek + 1) };
    });

  const setThreshold = (t: Threshold) => setState((s) => ({ ...s, threshold: t }));
  const removeStudent = (id: string) =>
    setState((s) => ({
      ...s,
      removed: s.removed.includes(id) ? s.removed : [...s.removed, id],
      shortlist: s.shortlist.filter((x) => x !== id),
    }));
  const removeStudents = (ids: string[]) =>
    setState((s) => ({
      ...s,
      removed: [...new Set([...s.removed, ...ids])],
      shortlist: s.shortlist.filter((x) => !ids.includes(x)),
    }));
  const restoreStudent = (id: string) =>
    setState((s) => ({ ...s, removed: s.removed.filter((x) => x !== id) }));

  const matchTeams = (size: number) =>
    setState((s) => {
      const active = ROSTER.map((st) => st.id).filter((id) => !s.removed.includes(id));
      return { ...s, teamSize: size, teams: chunk(active, size) };
    });
  const clearTeams = () => setState((s) => ({ ...s, teams: [] }));
  const teamOf = (id: string): string[] | null => {
    const team = state.teams.find((t) => t.includes(id));
    return team ? team.filter((x) => x !== id) : null;
  };

  const getMaterial = (courseId: string, day: number): Material | null =>
    state.materials[materialKey(courseId, day)] ?? null;
  const setMaterial = (courseId: string, day: number, mat: Material) =>
    setState((s) => {
      const key = materialKey(courseId, day);
      const next = { ...s.materials };
      if (!mat.text?.trim() && !mat.video?.trim()) delete next[key];
      else next[key] = { text: mat.text?.trim() || undefined, video: mat.video?.trim() || undefined };
      return { ...s, materials: next };
    });
  const toggleShortlist = (id: string) =>
    setState((s) => ({
      ...s,
      shortlist: s.shortlist.includes(id)
        ? s.shortlist.filter((x) => x !== id)
        : [...s.shortlist, id],
    }));

  const course = (courseId: string): CourseView => {
    const enrollment = getEnrollment(courseId) ?? MY_ENROLLMENTS[0];
    const p = state.byCourse[courseId] ?? initCourse(enrollment);
    const nextWeek = weekOf(Math.min(p.currentDay + 1, enrollment.daysTotal));
    const isCaughtUp =
      p.submitted.includes(p.currentDay) &&
      p.currentDay < enrollment.daysTotal &&
      !isAvailable(p, nextWeek);
    return {
      ...p,
      enrollment,
      isWeekAvailable: (week: number) => isAvailable(p, week),
      isCaughtUp,
      progressPct: Math.round((p.currentDay / enrollment.daysTotal) * 100),
      isSubmitted: (day: number) => p.submitted.includes(day),
    };
  };

  const value: ContextValue = {
    enrollments: MY_ENROLLMENTS,
    course,
    submitToday,
    requestEarlyAccess,
    threshold: state.threshold,
    setThreshold,
    removed: state.removed,
    removeStudent,
    removeStudents,
    restoreStudent,
    isRemoved: (id) => state.removed.includes(id),
    shortlist: state.shortlist,
    toggleShortlist,
    isShortlisted: (id) => state.shortlist.includes(id),
    rolloutNextWeek,
    grantEarlyAccess,
    teams: state.teams,
    teamSize: state.teamSize,
    matchTeams,
    clearTeams,
    teamOf,
    getMaterial,
    setMaterial,
    frontendEarlyRequested: state.byCourse[FRONTEND_ID]?.earlyRequested ?? false,
    reset: () => setState(INITIAL),
  };

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useCohort() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useCohort must be used within a CohortProvider");
  return ctx;
}

export { FRONTEND_ID };
