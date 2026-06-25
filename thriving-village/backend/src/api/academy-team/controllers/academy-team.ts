import { factories } from '@strapi/strapi';
import { idOrDocumentIdWhere } from '../../../utils/scoped-find';

const MEMBER_SELECT = { select: ['id', 'username', 'name', 'email', 'whatsapp'] };

function shapeMembers(team: any) {
  return {
    id: team.id,
    week: team.week,
    title: team.title,
    members: (team.members || []).map((m: any) => ({ id: m.id, name: m.name || m.username, email: m.email, whatsapp: m.whatsapp })),
  };
}

// Named distinctly from the default core `update`/`delete` actions (rather
// than overriding them) so the unrelated, unpermissioned default core routes
// at /academy-teams/:documentId stay exactly as inert as they were before —
// granting a permission for these action names must only ever unlock the
// custom /teams/:id routes that carry the ownership policy, never a second,
// unguarded path to the same effect.
export default factories.createCoreController('api::academy-team.academy-team', ({ strapi }) => ({
  async renameTeam(ctx) {
    const { id } = ctx.params;
    const { title } = (ctx.request.body as any) || {};
    if (!title) return ctx.badRequest('title is required.');

    const team = await strapi.db.query('api::academy-team.academy-team').findOne({ where: idOrDocumentIdWhere(id) });
    if (!team) return ctx.notFound('Team not found.');

    const updated = await strapi.db.query('api::academy-team.academy-team').update({
      where: { id: team.id },
      data: { title },
    });
    ctx.body = { data: { id: updated.id, title: updated.title } };
  },

  async deleteTeam(ctx) {
    const { id } = ctx.params;
    const team = await strapi.db.query('api::academy-team.academy-team').findOne({ where: idOrDocumentIdWhere(id) });
    if (!team) return ctx.notFound('Team not found.');

    await strapi.db.query('api::academy-team.academy-team').delete({ where: { id: team.id } });
    ctx.status = 204;
    ctx.body = null;
  },

  async addMember(ctx) {
    const { id } = ctx.params;
    const { userId } = (ctx.request.body as any) || {};
    if (!userId) return ctx.badRequest('userId is required.');

    const team = await strapi.db.query('api::academy-team.academy-team').findOne({
      where: idOrDocumentIdWhere(id),
      populate: { cohort: { select: ['id'] }, members: { select: ['id'] } },
    });
    if (!team) return ctx.notFound('Team not found.');

    if (team.members.some((m: any) => m.id === Number(userId))) {
      // Already on this team — idempotent no-op rather than an error.
      const current = await strapi.db.query('api::academy-team.academy-team').findOne({
        where: { id: team.id },
        populate: { members: MEMBER_SELECT },
      });
      return (ctx.body = { data: shapeMembers(current) });
    }

    // A user can't be on two teams in the same cohort at once.
    const conflicting = await strapi.db.query('api::academy-team.academy-team').findOne({
      where: { cohort: team.cohort.id, members: { id: Number(userId) }, id: { $ne: team.id } },
    });
    if (conflicting) return ctx.badRequest('This student is already on another team in this cohort.');

    await strapi.db.query('api::academy-team.academy-team').update({
      where: { id: team.id },
      data: { members: { connect: [Number(userId)] } },
    });

    const updated = await strapi.db.query('api::academy-team.academy-team').findOne({
      where: { id: team.id },
      populate: { members: MEMBER_SELECT },
    });
    ctx.body = { data: shapeMembers(updated) };
  },

  async removeMember(ctx) {
    const { id, userId } = ctx.params;
    const team = await strapi.db.query('api::academy-team.academy-team').findOne({ where: idOrDocumentIdWhere(id) });
    if (!team) return ctx.notFound('Team not found.');

    await strapi.db.query('api::academy-team.academy-team').update({
      where: { id: team.id },
      data: { members: { disconnect: [Number(userId)] } },
    });

    const updated = await strapi.db.query('api::academy-team.academy-team').findOne({
      where: { id: team.id },
      populate: { members: MEMBER_SELECT },
    });
    ctx.body = { data: shapeMembers(updated) };
  },
}));
