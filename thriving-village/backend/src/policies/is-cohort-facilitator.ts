/**
 * Hard-rule enforcement for facilitator scoping (ACADEMY_BACKEND_SPEC.md §1):
 * a facilitator may only act on cohorts where cohort.facilitator.id === self.
 * Admin bypasses. Attach to any route whose :id param is a cohort id.
 */
export default async (policyContext: any, _config: any, { strapi }: { strapi: any }) => {
  const user = policyContext.state.user;
  if (!user) return false;
  if (user.role?.type === 'admin') return true;
  if (user.role?.type !== 'facilitator') return false;

  const cohortId = policyContext.params.id;
  const cohort = await strapi.db.query('api::academy-cohort.academy-cohort').findOne({
    where: { id: cohortId },
    populate: { facilitator: { select: ['id'] } },
  });
  if (!cohort) return false;
  return cohort.facilitator?.id === user.id;
};
