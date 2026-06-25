import { factories } from '@strapi/strapi';
import { scopedFind, idOrDocumentIdWhere } from '../../../utils/scoped-find';
import { normalize, weekOf, type ProgressionState } from '../../../utils/academy-progression';
import { maybeCompleteEnrollment } from '../../../utils/academy-completion';
import { generateAnonHandle } from '../../../utils/anon-handle';
import { logActivity } from '../../../utils/activity';

// Strict: the daily-flow actions (submit/list/request-early-access/team) only
// ever make sense as "my own enrollment" — no admin/facilitator bypass here.
async function loadOwnEnrollment(strapi: any, ctx: any) {
  const { id } = ctx.params;
  const enrollment = await strapi.db.query('api::academy-enrollment.academy-enrollment').findOne({
    where: idOrDocumentIdWhere(id),
    populate: { cohort: { populate: { course: true } }, user: { select: ['id', 'username', 'name', 'email', 'whatsapp'] } },
  });
  if (!enrollment) return null;
  if (enrollment.user?.id !== ctx.state.user.id) return null;
  return enrollment;
}

// Looser: for reading a single enrollment (GET /academy-enrollments/:id),
// admin can view any enrollment (it already has core create/update access to
// all of them) — students are still restricted to their own.
async function loadVisibleEnrollment(strapi: any, ctx: any) {
  const { id } = ctx.params;
  const enrollment = await strapi.db.query('api::academy-enrollment.academy-enrollment').findOne({
    where: idOrDocumentIdWhere(id),
    populate: { cohort: { populate: { course: true } }, user: { select: ['id', 'username', 'name', 'email', 'whatsapp'] } },
  });
  if (!enrollment) return null;
  if (ctx.state.user.role?.type === 'admin') return enrollment;
  if (enrollment.user?.id !== ctx.state.user.id) return null;
  return enrollment;
}

export default factories.createCoreController('api::academy-enrollment.academy-enrollment', ({ strapi }) => ({
  async delete(ctx) {
    const { id } = ctx.params; // documentId, per Strapi v5's core route convention
    const enrollment = await strapi.db.query('api::academy-enrollment.academy-enrollment').findOne({
      where: idOrDocumentIdWhere(id),
    });
    if (!enrollment) return ctx.notFound('Enrollment not found.');

    // Hard-deleting a real student's enrollment would orphan their judged
    // work — only allow this for enrollments with no submissions/certificate
    // (data-hygiene cleanup of corrupted/empty rows, not a normal app flow;
    // students are otherwise soft-removed via removed: true).
    const submissionCount = await strapi.db.query('api::academy-submission.academy-submission').count({
      where: { enrollment: enrollment.id },
    });
    const certificate = await strapi.db.query('api::academy-certificate.academy-certificate').findOne({
      where: { enrollment: enrollment.id },
    });
    if (submissionCount > 0 || certificate) {
      return ctx.badRequest('This enrollment has submissions or a certificate attached and cannot be deleted.');
    }

    await strapi.db.query('api::academy-enrollment.academy-enrollment').delete({ where: { id: enrollment.id } });
    await logActivity(strapi, { who: 'An admin', what: 'deleted an enrollment record', kind: 'gate-action' });
    ctx.status = 204;
    ctx.body = null;
  },

  async find(ctx) {
    const isAdmin = ctx.state.user.role?.type === 'admin';
    return scopedFind(
      strapi,
      'api::academy-enrollment.academy-enrollment',
      ctx,
      isAdmin ? {} : { user: ctx.state.user.id }
    );
  },

  async findOne(ctx) {
    const enrollment = await loadVisibleEnrollment(strapi, ctx);
    if (!enrollment) return ctx.notFound();
    ctx.body = { data: enrollment };
  },

  async submitTask(ctx) {
    const enrollment = await loadOwnEnrollment(strapi, ctx);
    if (!enrollment) return ctx.notFound('Enrollment not found.');

    const { day, url, note } = (ctx.request.body as any) || {};
    if (!url) return ctx.badRequest('url is required.');
    // Never trust a client-supplied day past validation — a student can only
    // ever submit *today's* task, never an arbitrary future day.
    if (Number(day) !== enrollment.currentDay) return ctx.badRequest('You can only submit today\'s task.');

    const cohort = enrollment.cohort;
    const course = cohort.course;

    const anonHandle = await generateAnonHandle(strapi);
    await strapi.db.query('api::academy-submission.academy-submission').create({
      data: {
        enrollment: enrollment.id,
        day: enrollment.currentDay,
        week: weekOf(enrollment.currentDay),
        task: `Day ${enrollment.currentDay} task`,
        courseTitle: course.title,
        url,
        note,
        submittedAt: new Date(),
        rated: false,
        anonHandle,
      },
    });

    const submittedDays = enrollment.submittedDays.includes(enrollment.currentDay)
      ? enrollment.submittedDays
      : [...enrollment.submittedDays, enrollment.currentDay];

    const state: ProgressionState = {
      currentDay: enrollment.currentDay,
      submittedDays,
      releasedWeek: cohort.releasedWeek,
      earlyWeeks: enrollment.earlyWeeks,
    };
    const next = normalize(state, cohort.daysTotal);

    await strapi.db.query('api::academy-enrollment.academy-enrollment').update({
      where: { id: enrollment.id },
      data: { submittedDays, currentDay: next.currentDay },
    });

    await maybeCompleteEnrollment(strapi, { ...enrollment, currentDay: next.currentDay }, cohort, course);
    await logActivity(strapi, {
      who: enrollment.user.name || enrollment.user.username,
      what: `submitted day ${enrollment.currentDay} of ${course.title}`,
      kind: 'gate-action',
    });

    ctx.body = {
      data: {
        currentDay: next.currentDay,
        submittedDays,
        releasedWeek: cohort.releasedWeek,
        earlyWeeks: enrollment.earlyWeeks,
      },
    };
  },

  async listSubmissions(ctx) {
    const enrollment = await loadOwnEnrollment(strapi, ctx);
    if (!enrollment) return ctx.notFound('Enrollment not found.');
    const submissions = await strapi.db.query('api::academy-submission.academy-submission').findMany({
      where: { enrollment: enrollment.id },
      orderBy: { day: 'desc' },
    });
    ctx.body = { data: submissions };
  },

  async requestEarlyAccess(ctx) {
    const enrollment = await loadOwnEnrollment(strapi, ctx);
    if (!enrollment) return ctx.notFound('Enrollment not found.');
    await strapi.db.query('api::academy-enrollment.academy-enrollment').update({
      where: { id: enrollment.id },
      data: { earlyAccessRequested: true },
    });
    await logActivity(strapi, {
      who: enrollment.user.name || enrollment.user.username,
      what: 'requested early access to the next week',
      kind: 'early-access',
    });
    ctx.body = { data: { earlyAccessRequested: true } };
  },

  async grantEarlyAccess(ctx) {
    const { id } = ctx.params;
    const enrollment = await strapi.db.query('api::academy-enrollment.academy-enrollment').findOne({
      where: idOrDocumentIdWhere(id),
      populate: { cohort: true, user: { select: ['id', 'username', 'name', 'email', 'whatsapp'] } },
    });
    if (!enrollment) return ctx.notFound('Enrollment not found.');

    const nextWeek = enrollment.cohort.releasedWeek + 1;
    const earlyWeeks = Array.from(new Set([...(enrollment.earlyWeeks || []), nextWeek]));
    const state: ProgressionState = {
      currentDay: enrollment.currentDay,
      submittedDays: enrollment.submittedDays,
      releasedWeek: enrollment.cohort.releasedWeek,
      earlyWeeks,
    };
    const next = normalize(state, enrollment.cohort.daysTotal);

    await strapi.db.query('api::academy-enrollment.academy-enrollment').update({
      where: { id: enrollment.id },
      data: { earlyAccessRequested: false, earlyWeeks, currentDay: next.currentDay },
    });

    await logActivity(strapi, {
      who: enrollment.user.name || enrollment.user.username,
      what: 'was granted early access to the next week',
      kind: 'early-access',
    });

    ctx.body = { data: { earlyWeeks, currentDay: next.currentDay } };
  },

  async team(ctx) {
    const enrollment = await loadOwnEnrollment(strapi, ctx);
    if (!enrollment) return ctx.notFound('Enrollment not found.');

    const team = await strapi.db.query('api::academy-team.academy-team').findOne({
      where: { cohort: enrollment.cohort.id, members: { id: enrollment.user.id } },
      populate: { members: { select: ['id', 'username', 'name', 'email', 'whatsapp'] } },
    });
    if (!team) return (ctx.body = { data: null });

    ctx.body = {
      data: team.members
        .filter((m: any) => m.id !== enrollment.user.id)
        .map((m: any) => ({ id: m.id, name: m.name || m.username, email: m.email, whatsapp: m.whatsapp })),
    };
  },
}));
