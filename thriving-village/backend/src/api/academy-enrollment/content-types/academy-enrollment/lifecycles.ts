import utils from '@strapi/utils';

const { ValidationError } = utils.errors;

// Strapi v5 schema.json has no declarative composite-unique constraint, so
// (user, cohort) uniqueness is enforced here instead.
export default {
  async beforeCreate(event: any) {
    const { data } = event.params;
    const userId = typeof data.user === 'object' ? data.user?.id ?? data.user?.connect?.[0]?.id : data.user;
    const cohortId = typeof data.cohort === 'object' ? data.cohort?.id ?? data.cohort?.connect?.[0]?.id : data.cohort;
    if (!userId || !cohortId) return;
    const existing = await strapi.db.query('api::academy-enrollment.academy-enrollment').findOne({
      where: { user: userId, cohort: cohortId },
    });
    if (existing) throw new ValidationError('This user is already enrolled in this cohort.');
  },
};
