import { factories } from '@strapi/strapi';
import { normalize, type ProgressionState } from '../../../utils/academy-progression';
import { maybeCompleteEnrollment } from '../../../utils/academy-completion';
import { logActivity } from '../../../utils/activity';

export default factories.createCoreService('api::academy-cohort.academy-cohort', ({ strapi }) => ({
  // Bumps releasedWeek up to `targetWeek` (clamped to weeksTotal) and
  // auto-advances every caught-up enrollment into the newly released week(s).
  // Shared by the manual POST /cohorts/:id/rollout-next-week action and the
  // daily cron tick so both code paths apply identical progression rules.
  async rolloutToWeek(cohortId: number, targetWeek: number) {
    const cohort = await strapi.db.query('api::academy-cohort.academy-cohort').findOne({
      where: { id: cohortId },
      populate: { course: true },
    });
    if (!cohort) return null;

    const releasedWeek = Math.max(cohort.releasedWeek, Math.min(cohort.weeksTotal, targetWeek));
    if (releasedWeek === cohort.releasedWeek) return cohort;

    await strapi.db.query('api::academy-cohort.academy-cohort').update({
      where: { id: cohortId },
      data: { releasedWeek },
    });

    const enrollments = await strapi.db.query('api::academy-enrollment.academy-enrollment').findMany({
      where: { cohort: cohortId, removed: false },
      populate: { user: true },
    });

    for (const enrollment of enrollments) {
      const state: ProgressionState = {
        currentDay: enrollment.currentDay,
        submittedDays: enrollment.submittedDays || [],
        releasedWeek,
        earlyWeeks: enrollment.earlyWeeks || [],
      };
      const next = normalize(state, cohort.daysTotal);
      if (next.currentDay !== enrollment.currentDay) {
        await strapi.db.query('api::academy-enrollment.academy-enrollment').update({
          where: { id: enrollment.id },
          data: { currentDay: next.currentDay },
        });
      }
      await maybeCompleteEnrollment(strapi, { ...enrollment, currentDay: next.currentDay }, cohort, cohort.course);
    }

    await logActivity(strapi, {
      who: 'System',
      what: `rolled out week ${releasedWeek} for ${cohort.name}`,
      kind: 'rollout',
    });

    return { ...cohort, releasedWeek };
  },
}));
