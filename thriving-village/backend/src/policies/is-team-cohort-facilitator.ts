import { idOrDocumentIdWhere } from '../utils/scoped-find';

/**
 * Same hard rule as is-cohort-facilitator.ts, for routes whose :id param is a
 * team id rather than a cohort id (rename/delete/add-member/remove-member) —
 * the cohort is resolved through the team first.
 */
export default async (policyContext: any, _config: any, { strapi }: { strapi: any }) => {
  const user = policyContext.state.user;
  if (!user) return false;
  if (user.role?.type === 'admin') return true;
  if (user.role?.type !== 'facilitator') return false;

  const teamId = policyContext.params.id;
  const team = await strapi.db.query('api::academy-team.academy-team').findOne({
    where: idOrDocumentIdWhere(teamId),
    populate: { cohort: { populate: { facilitator: { select: ['id'] } } } },
  });
  if (!team) return false;
  return team.cohort?.facilitator?.id === user.id;
};
