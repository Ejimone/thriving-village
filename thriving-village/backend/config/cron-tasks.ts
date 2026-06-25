export default {
  'academy-weekly-rollout': {
    task: async ({ strapi }: { strapi: any }) => {
      const cohorts = await strapi.db.query('api::academy-cohort.academy-cohort').findMany({
        where: { status: { $in: ['Enrolling', 'Running'] } },
      });

      for (const cohort of cohorts) {
        try {
          const expectedWeek = Math.min(
            cohort.weeksTotal,
            Math.max(1, Math.ceil((Date.now() - new Date(cohort.startDate).getTime()) / (7 * 86400000))),
          );
          if (expectedWeek > cohort.releasedWeek) {
            await strapi.service('api::academy-cohort.academy-cohort').rolloutToWeek(cohort.id, expectedWeek);
          }
        } catch (err) {
          strapi.log.error(`[academy-weekly-rollout] failed for cohort ${cohort.id}: ${err}`);
        }
      }
    },
    options: {
      rule: '0 1 * * *', // daily at 01:00 server time
    },
  },
};
