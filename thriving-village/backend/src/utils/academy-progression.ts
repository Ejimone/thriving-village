/**
 * Server-side port of the Academy frontend's progression engine
 * (academy-components-for frontend/academy/CohortProvider.tsx). Pure
 * functions, no Strapi imports — every caller is responsible for persisting
 * the returned state.
 */

export const DAYS_PER_WEEK = 7;

export const weekOf = (day: number) => Math.ceil(day / DAYS_PER_WEEK);

export type ProgressionState = {
  currentDay: number;
  submittedDays: number[];
  releasedWeek: number;
  earlyWeeks: number[];
};

export function isAvailable(
  p: Pick<ProgressionState, 'releasedWeek' | 'earlyWeeks'>,
  week: number,
): boolean {
  return week <= p.releasedWeek || p.earlyWeeks.includes(week);
}

/** Advances currentDay through any already-submitted, now-available days. */
export function normalize(p: ProgressionState, daysTotal: number): ProgressionState {
  let currentDay = p.currentDay;
  while (
    currentDay < daysTotal &&
    p.submittedDays.includes(currentDay) &&
    isAvailable(p, weekOf(currentDay + 1))
  ) {
    currentDay += 1;
  }
  return { ...p, currentDay };
}

export function isCaughtUp(p: ProgressionState, daysTotal: number): boolean {
  const nextWeek = weekOf(Math.min(p.currentDay + 1, daysTotal));
  return p.submittedDays.includes(p.currentDay) && p.currentDay < daysTotal && !isAvailable(p, nextWeek);
}

export function paceCompletion(dayReached: number, releasedDay: number): number {
  if (releasedDay <= 0) return 0;
  return Math.min(100, Math.round((dayReached / releasedDay) * 100));
}

export function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}
