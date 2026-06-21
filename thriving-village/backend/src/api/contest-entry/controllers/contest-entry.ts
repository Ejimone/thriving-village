import { factories } from '@strapi/strapi';
import { scopedFind } from '../../../utils/scoped-find';

export default factories.createCoreController('api::contest-entry.contest-entry', ({ strapi }) => ({
  async find(ctx) {
    const user = ctx.state.user;
    const isAdmin = user?.role?.name === 'Admin';
    const where = isAdmin ? {} : { user: user.id };
    ctx.body = await scopedFind(strapi, 'api::contest-entry.contest-entry', ctx, where);
  },

  async findOne(ctx) {
    const user = ctx.state.user;
    const isAdmin = user?.role?.name === 'Admin';
    if (!isAdmin) {
      const record = await strapi.db.query('api::contest-entry.contest-entry').findOne({
        where: { $or: [{ documentId: ctx.params.id }, { id: ctx.params.id }] },
        populate: { user: true },
      });
      if (!record || record.user?.id !== user.id) return ctx.notFound();
    }
    return super.findOne(ctx);
  },
}));
