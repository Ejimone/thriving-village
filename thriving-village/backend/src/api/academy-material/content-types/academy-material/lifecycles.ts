import utils from '@strapi/utils';

const { ValidationError } = utils.errors;

// Strapi v5 schema.json has no declarative composite-unique constraint, so
// (course, day) uniqueness is enforced here instead. The controller's `put`
// action upserts (update-if-exists) rather than blindly creating, so this is
// a safety net against any other write path.
export default {
  async beforeCreate(event: any) {
    const { data } = event.params;
    const courseId = typeof data.course === 'object' ? data.course?.id ?? data.course?.connect?.[0]?.id : data.course;
    if (!courseId || !data.day) return;
    const existing = await strapi.db.query('api::academy-material.academy-material').findOne({
      where: { course: courseId, day: data.day },
    });
    if (existing) throw new ValidationError('Material already exists for this course and day.');
  },
};
