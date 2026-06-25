import { factories } from '@strapi/strapi';

export default factories.createCoreController('api::academy-course.academy-course', ({ strapi }) => ({
  // GET /courses/:courseId/curriculum — outline only (weeks -> days -> has-material
  // flag); never returns material content itself, just enough for the admin
  // curriculum tree / student day-strip to render.
  async curriculum(ctx) {
    const { courseId } = ctx.params;
    const course = await strapi.db.query('api::academy-course.academy-course').findOne({
      where: { id: courseId },
    });
    if (!course) return ctx.notFound('Course not found.');

    const materials = await strapi.db.query('api::academy-material.academy-material').findMany({
      where: { course: courseId },
      select: ['day'],
    });
    const authoredDays = new Set(materials.map((m: any) => m.day));

    const weeks = [];
    for (let week = 1; week <= course.weeksTotal; week++) {
      const days = [];
      for (let d = 1; d <= 7; d++) {
        const day = (week - 1) * 7 + d;
        if (day > course.daysTotal) break;
        days.push({ day, hasMaterial: authoredDays.has(day) });
      }
      weeks.push({ week, days });
    }

    ctx.body = { data: { weeksTotal: course.weeksTotal, daysTotal: course.daysTotal, weeks } };
  },
}));
