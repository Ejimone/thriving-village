import { factories } from '@strapi/strapi';
import { idOrDocumentIdWhere } from '../../../utils/scoped-find';
import { shapeRosterRequest } from '../../../utils/roster-request';

const ADMIN_SETTABLE_STATUSES = ['Fulfilled', 'Dismissed'];

export default factories.createCoreController('api::academy-roster-request.academy-roster-request', ({ strapi }) => ({
  async updateStatus(ctx) {
    const { id } = ctx.params; // numeric request id
    const { status } = (ctx.request.body as any) || {};
    if (!status || !ADMIN_SETTABLE_STATUSES.includes(status)) {
      return ctx.badRequest(`status must be one of: ${ADMIN_SETTABLE_STATUSES.join(', ')}`);
    }

    const request = await strapi.db.query('api::academy-roster-request.academy-roster-request').findOne({
      where: idOrDocumentIdWhere(id),
    });
    if (!request) return ctx.notFound('Roster request not found.');

    const updated = await strapi.db.query('api::academy-roster-request.academy-roster-request').update({
      where: { id: request.id },
      data: { status },
      populate: {
        cohort: { populate: { course: { select: ['title'] } } },
        facilitator: { select: ['id', 'name', 'username'] },
      },
    });
    ctx.body = { data: shapeRosterRequest(updated) };
  },
}));
