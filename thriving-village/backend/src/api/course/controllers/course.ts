import { factories } from '@strapi/strapi';
import { resolveSlugParam } from '../../../utils/scoped-find';

const lessonCount = (modules: any[] = []) =>
  modules.reduce((n, m) => n + (m.lessons?.length || 0), 0);

const withComputed = (entity: any) => {
  if (!entity) return entity;
  if (Array.isArray(entity)) return entity.map(withComputed);
  return { ...entity, lessonCount: lessonCount(entity.modules) };
};

export default factories.createCoreController('api::course.course', ({ strapi }) => ({
  async find(ctx) {
    // list view: never populate modules (heaviest payload), only computed lessonCount
    const { data, meta } = await super.find(ctx);
    return { data, meta };
  },

  async findOne(ctx) {
    await resolveSlugParam(strapi, 'api::course.course', ctx);
    ctx.query = { ...ctx.query, populate: ctx.query.populate || ['modules', 'modules.lessons'] };
    const response = await super.findOne(ctx);
    return { data: withComputed(response?.data), meta: response?.meta };
  },

  async enroll(ctx) {
    const { slug } = ctx.params;
    const user = ctx.state.user;
    if (!user) return ctx.unauthorized('You must be signed in to enroll.');

    const course = await strapi.db.query('api::course.course').findOne({ where: { slug } });
    if (!course) return ctx.notFound('Course not found.');

    const existing = await strapi.db.query('api::enrollment.enrollment').findOne({
      where: { course: course.id, user: user.id },
    });
    if (existing) return ctx.conflict('You are already enrolled in this course.');

    const body = (ctx.request.body as any) || {};
    const { name, whatsapp, message } = body;
    if (!name || !whatsapp) return ctx.badRequest('name and whatsapp are required.');

    const enrollment = await strapi.entityService.create('api::enrollment.enrollment', {
      data: { course: course.id, user: user.id, name, whatsapp, message },
    });

    await strapi.db.query('api::activity-log.activity-log').create({
      data: {
        who: name,
        what: `enrolled in ${course.title}`,
        kind: 'enrollment',
        occurredAt: new Date(),
      },
    });

    ctx.body = { data: enrollment };
  },
}));
