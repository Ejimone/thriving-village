import { factories } from '@strapi/strapi';
import { scopedFind } from '../../../utils/scoped-find';

export default factories.createCoreController('api::lesson-progress.lesson-progress', ({ strapi }) => ({
  async find(ctx) {
    const user = ctx.state.user;
    const isAdmin = user?.role?.name === 'Admin';
    const where: Record<string, unknown> = isAdmin ? {} : { user: user.id };
    // Plain query param, not a Strapi `filters[...]` key — scopedFind bypasses
    // the REST query validator entirely (see scoped-find.ts), so it never
    // reads ctx.query.filters. This is how LessonViewer asks for "just this
    // course's progress" without pulling every course the user has touched.
    const courseId = ctx.query.courseId;
    if (courseId) where.course = Number(courseId);
    ctx.body = await scopedFind(strapi, 'api::lesson-progress.lesson-progress', ctx, where);
  },

  async mark(ctx) {
    const user = ctx.state.user;
    const { courseId, lessonKey } = ctx.request.body as any;
    if (!courseId || !lessonKey) return ctx.badRequest('courseId and lessonKey are required.');

    const course = await strapi.db.query('api::course.course').findOne({
      where: { id: courseId },
      populate: { modules: { populate: ['lessons'] } },
    });
    if (!course) return ctx.notFound('Course not found.');

    const validKeys = new Set(
      (course.modules || []).flatMap((m: any) => (m.lessons || []).map((l: any) => l.key))
    );
    if (!validKeys.has(lessonKey)) return ctx.badRequest('Unknown lessonKey for this course.');

    const existing = await strapi.db.query('api::lesson-progress.lesson-progress').findOne({
      where: { user: user.id, course: course.id, lessonKey },
    });
    if (existing) {
      ctx.body = { data: existing };
      return;
    }

    const progress = await strapi.entityService.create('api::lesson-progress.lesson-progress', {
      data: { user: user.id, course: course.id, lessonKey, completedAt: new Date() },
    });
    ctx.body = { data: progress };
  },
}));
