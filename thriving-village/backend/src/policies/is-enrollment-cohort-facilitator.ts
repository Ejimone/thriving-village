/**
 * Same hard rule as is-cohort-facilitator.ts, for routes whose :id param is
 * an enrollment id rather than a cohort id (e.g. grant-early-access) — the
 * cohort is resolved through the enrollment first.
 */
import { idOrDocumentIdWhere } from '../utils/scoped-find';

export default async (policyContext: any, _config: any, { strapi }: { strapi: any }) => {
  const user = policyContext.state.user;
  if (!user) return false;
  if (user.role?.type === 'admin') return true;
  if (user.role?.type !== 'facilitator') return false;

  const enrollmentId = policyContext.params.id;
  const enrollment = await strapi.db.query('api::academy-enrollment.academy-enrollment').findOne({
    where: idOrDocumentIdWhere(enrollmentId),
    populate: { cohort: { populate: { facilitator: { select: ['id'] } } } },
  });
  if (!enrollment) return false;
  return enrollment.cohort?.facilitator?.id === user.id;
};
