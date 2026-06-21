import { factories } from '@strapi/strapi';
import { resolveSlugParam } from '../../../utils/scoped-find';
import { slugify, uniqueSlug } from '../../../utils/slugify';
import { cached, invalidateScope } from '../../../utils/cache';
import { logActivity } from '../../../utils/activity';

const lessonCount = (modules: any[] = []) =>
  modules.reduce((n, m) => n + (m.lessons?.length || 0), 0);

const withComputed = (entity: any) => {
  if (!entity) return entity;
  if (Array.isArray(entity)) return entity.map(withComputed);
  return { ...entity, lessonCount: lessonCount(entity.modules) };
};

export default factories.createCoreController('api::course.course', ({ strapi }) => ({
  async create(ctx) {
    const body = ctx.request.body as any;
    if (body?.data?.title && !body.data.slug) {
      body.data.slug = await uniqueSlug(strapi, 'api::course.course', slugify(body.data.title));
    }
    const result = await super.create(ctx);
    await invalidateScope('courses');
    return result;
  },

  async update(ctx) {
    const result = await super.update(ctx);
    await invalidateScope('courses');
    return result;
  },

  async delete(ctx) {
    const result = await super.delete(ctx);
    await invalidateScope('courses');
    return result;
  },

  async find(ctx) {
    // list view: populate only lesson `id`s (never titles/durations/etc — the heavy part)
    // so lessonCount can be computed without paying for the full curriculum payload.
    ctx.query = {
      ...ctx.query,
      populate: ctx.query.populate || { modules: { populate: { lessons: { fields: ['id'] } } } },
    };
    const { data, meta } = await cached<{ data: any; meta: any }>('courses', JSON.stringify(ctx.query), 30, () => super.find(ctx));
    const withCount = withComputed(data);
    // Strip the populated modules back out — list responses should carry lessonCount, not the curriculum itself.
    const stripped = Array.isArray(withCount)
      ? withCount.map(({ modules, ...rest }: any) => rest)
      : withCount;
    return { data: stripped, meta };
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

    await logActivity(strapi, { who: name, what: `enrolled in ${course.title}`, kind: 'enrollment' });

    ctx.body = { data: enrollment };
  },
}));
