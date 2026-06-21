import { factories } from '@strapi/strapi';
import { scopedFind } from '../../../utils/scoped-find';

export default factories.createCoreController('api::saved-job.saved-job', ({ strapi }) => ({
  async find(ctx) {
    const user = ctx.state.user;
    ctx.body = await scopedFind(strapi, 'api::saved-job.saved-job', ctx, { user: user.id });
  },

  async save(ctx) {
    const user = ctx.state.user;
    const { jobSlug } = ctx.request.body as any;
    if (!jobSlug) return ctx.badRequest('jobSlug is required.');

    const job = await strapi.db.query('api::job.job').findOne({ where: { slug: jobSlug } });
    if (!job) return ctx.notFound('Job not found.');

    const existing = await strapi.db.query('api::saved-job.saved-job').findOne({
      where: { job: job.id, user: user.id },
    });
    if (existing) {
      ctx.body = { data: existing };
      return;
    }

    const saved = await strapi.entityService.create('api::saved-job.saved-job', {
      data: { job: job.id, user: user.id },
    });
    ctx.body = { data: saved };
  },

  async unsave(ctx) {
    const user = ctx.state.user;
    const { jobSlug } = ctx.params;

    const job = await strapi.db.query('api::job.job').findOne({ where: { slug: jobSlug } });
    if (!job) return ctx.notFound('Job not found.');

    const existing = await strapi.db.query('api::saved-job.saved-job').findOne({
      where: { job: job.id, user: user.id },
    });
    if (!existing) return ctx.notFound('Saved job not found.');

    await strapi.entityService.delete('api::saved-job.saved-job', existing.id);
    ctx.body = { data: { jobSlug } };
  },
}));
