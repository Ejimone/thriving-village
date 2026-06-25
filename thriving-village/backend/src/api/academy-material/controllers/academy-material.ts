import { factories } from '@strapi/strapi';
import { createDirectUpload, signPlaybackToken } from '../../../utils/mux';

async function canAccessCourseMaterial(strapi: any, ctx: any, courseId: string) {
  const user = ctx.state.user;
  if (user.role?.type === 'admin') return true;
  if (user.role?.type === 'facilitator') {
    const cohort = await strapi.db.query('api::academy-cohort.academy-cohort').findOne({
      where: { course: courseId, facilitator: user.id },
    });
    return Boolean(cohort);
  }
  const enrollment = await strapi.db.query('api::academy-enrollment.academy-enrollment').findOne({
    where: { removed: false, cohort: { course: courseId }, user: user.id },
  });
  return Boolean(enrollment);
}

export default factories.createCoreController('api::academy-material.academy-material', ({ strapi }) => ({
  async find(ctx) {
    const { courseId, day } = ctx.params;
    if (!(await canAccessCourseMaterial(strapi, ctx, courseId))) return ctx.forbidden();

    const material = await strapi.db.query('api::academy-material.academy-material').findOne({
      where: { course: courseId, day },
    });
    // Per spec: unauthored material returns null, never 404 — the client
    // decides whether to fall back to a generated placeholder.
    if (!material) return (ctx.body = { data: null });

    ctx.body = {
      data: {
        text: material.text,
        externalVideoUrl: material.externalVideoUrl,
        task: material.task,
        taskDetail: material.taskDetail,
        docs: material.docs,
        hasVideoPlayback: Boolean(material.muxPlaybackId),
      },
    };
  },

  async put(ctx) {
    const { courseId, day } = ctx.params;
    const { videoUrl, text, task, taskDetail, docs } = (ctx.request.body as any) || {};
    const existing = await strapi.db.query('api::academy-material.academy-material').findOne({
      where: { course: courseId, day },
    });
    const data = { text, externalVideoUrl: videoUrl, task, taskDetail, docs };
    const material = existing
      ? await strapi.db.query('api::academy-material.academy-material').update({ where: { id: existing.id }, data })
      : await strapi.db.query('api::academy-material.academy-material').create({ data: { course: courseId, day, ...data } });
    ctx.body = { data: material };
  },

  async delete(ctx) {
    const { courseId, day } = ctx.params;
    await strapi.db.query('api::academy-material.academy-material').deleteMany({ where: { course: courseId, day } });
    ctx.body = { data: { deleted: true } };
  },

  async muxUploadUrl(ctx) {
    const { courseId, day } = ctx.params;
    const upload = await createDirectUpload();

    const existing = await strapi.db.query('api::academy-material.academy-material').findOne({
      where: { course: courseId, day },
    });
    if (existing) {
      await strapi.db.query('api::academy-material.academy-material').update({
        where: { id: existing.id },
        data: { muxUploadId: upload.id },
      });
    } else {
      await strapi.db.query('api::academy-material.academy-material').create({
        data: { course: courseId, day, muxUploadId: upload.id },
      });
    }

    ctx.body = { data: { uploadUrl: upload.url, uploadId: upload.id } };
  },

  async getPlaybackToken(ctx) {
    const { courseId, day } = ctx.params;
    if (!(await canAccessCourseMaterial(strapi, ctx, courseId))) return ctx.forbidden();

    const material = await strapi.db.query('api::academy-material.academy-material').findOne({
      where: { course: courseId, day },
    });
    if (!material?.muxPlaybackId) return ctx.notFound('No video for this lesson.');

    ctx.body = { data: { token: await signPlaybackToken(material.muxPlaybackId) } };
  },
}));
