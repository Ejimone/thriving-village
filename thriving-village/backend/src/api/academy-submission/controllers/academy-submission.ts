import { factories } from '@strapi/strapi';
import { logActivity } from '../../../utils/activity';

const timeAgo = (date: string | Date): string => {
  const ms = Date.now() - new Date(date).getTime();
  const mins = Math.floor(ms / 60000);
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`;
  const days = Math.floor(hours / 24);
  return days === 1 ? 'yesterday' : `${days} days ago`;
};

export default factories.createCoreController('api::academy-submission.academy-submission', ({ strapi }) => ({
  // Judge anonymity is a hard rule (ACADEMY_BACKEND_SPEC.md §7) — this query
  // NEVER populates `enrollment` (the relation chain that leads back to
  // user/cohort). `courseTitle` and `anonHandle` are denormalized onto the
  // submission specifically so this endpoint never needs to touch identity.
  async judgeQueue(ctx) {
    const submissions = await strapi.db.query('api::academy-submission.academy-submission').findMany({
      where: { rated: false },
      select: ['id', 'day', 'week', 'task', 'courseTitle', 'url', 'note', 'submittedAt', 'anonHandle'],
      orderBy: { submittedAt: 'asc' },
      limit: 50,
    });

    ctx.body = {
      data: submissions.map((s: any) => ({
        id: s.anonHandle,
        submissionId: s.id,
        course: s.courseTitle,
        task: s.task,
        week: s.week,
        submittedAgo: timeAgo(s.submittedAt),
        url: s.url,
        note: s.note || '',
      })),
    };
  },

  async rate(ctx) {
    const { id } = ctx.params;
    const { scores, feedback } = (ctx.request.body as any) || {};
    if (!scores || typeof scores.brief !== 'number' || typeof scores.craft !== 'number' || typeof scores.originality !== 'number') {
      return ctx.badRequest('scores.{brief,craft,originality} are required.');
    }

    const submission = await strapi.db.query('api::academy-submission.academy-submission').findOne({
      where: { id },
      select: ['id', 'rated'],
    });
    if (!submission) return ctx.notFound('Submission not found.');
    if (submission.rated) return ctx.conflict('This submission has already been rated.');

    const existing = await strapi.db.query('api::academy-judgment.academy-judgment').findOne({
      where: { submission: id, judge: ctx.state.user.id },
    });
    if (existing) return ctx.conflict('You have already rated this submission.');

    const average = Math.round(((scores.brief + scores.craft + scores.originality) / 3) * 10) / 10;
    const judgment = await strapi.db.query('api::academy-judgment.academy-judgment').create({
      data: {
        submission: id,
        judge: ctx.state.user.id,
        brief: scores.brief,
        craft: scores.craft,
        originality: scores.originality,
        average,
        feedback,
      },
    });

    // Single-judge-rates-once-and-it's-done — first rating closes out the item.
    await strapi.db.query('api::academy-submission.academy-submission').update({
      where: { id },
      data: { rated: true },
    });

    // Never name the judge here, even to admins — keep the activity feed's
    // anonymized phrasing ("A judge rated...") consistent with the mock data.
    await logActivity(strapi, { who: 'A judge', what: 'rated a submission', kind: 'judgment' });

    ctx.body = { data: { average: judgment.average } };
  },
}));
