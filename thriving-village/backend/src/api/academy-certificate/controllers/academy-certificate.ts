import { factories } from '@strapi/strapi';

export default factories.createCoreController('api::academy-certificate.academy-certificate', ({ strapi }) => ({
  async verify(ctx) {
    const { code } = ctx.params;
    const certificate = await strapi.db.query('api::academy-certificate.academy-certificate').findOne({
      where: { verificationCode: code },
      select: ['studentNameSnapshot', 'courseTitleSnapshot', 'cohortNameSnapshot', 'issuedAt'],
    });
    if (!certificate) return ctx.notFound('No certificate found for this code.');
    ctx.body = { data: certificate };
  },
}));
