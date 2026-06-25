import { factories } from '@strapi/strapi';
import { paceCompletion, chunk, normalize, type ProgressionState } from '../../../utils/academy-progression';
import { logActivity } from '../../../utils/activity';
import { idOrDocumentIdWhere, scopedFind } from '../../../utils/scoped-find';

const FACILITATOR_SELECT = { select: ['id', 'name', 'username'] };

// facilitator targets plugin::users-permissions.user — going through db.query
// directly (rather than the content-API's super.find/findOne) sidesteps any
// risk of hitting the same kind of relation restriction that blocks writes to
// user-relations without the `find` permission (see src/index.ts); db.query
// has no such restriction on reads.
function shapeFacilitator(cohort: any) {
  if (!cohort) return cohort;
  const f = cohort.facilitator;
  return { ...cohort, facilitator: f ? { id: f.id, name: f.name || f.username } : null };
}

function withFacilitatorPopulate(existing: any) {
  if (!existing) return { facilitator: FACILITATOR_SELECT };
  if (existing === '*') return existing;
  if (typeof existing === 'string') {
    const obj: Record<string, true> = {};
    for (const key of existing.split(',')) obj[key.trim()] = true;
    return { ...obj, facilitator: FACILITATOR_SELECT };
  }
  if (Array.isArray(existing)) {
    const obj: Record<string, true> = {};
    for (const key of existing) obj[key] = true;
    return { ...obj, facilitator: FACILITATOR_SELECT };
  }
  return { ...existing, facilitator: FACILITATOR_SELECT };
}

const timeAgo = (date: string | Date): string => {
  const ms = Date.now() - new Date(date).getTime();
  const days = Math.floor(ms / 86400000);
  if (days <= 0) return 'today';
  if (days === 1) return '1 day ago';
  if (days < 7) return `${days} days ago`;
  const weeks = Math.floor(days / 7);
  return weeks === 1 ? '1 week ago' : `${weeks} weeks ago`;
};

const standingFor = (currentDay: number, releasedWeek: number): 'on-track' | 'behind' | 'at-risk' => {
  const pace = paceCompletion(currentDay, releasedWeek * 7);
  if (pace >= 85) return 'on-track';
  if (pace >= 60) return 'behind';
  return 'at-risk';
};

async function assertCohortVisible(strapi: any, ctx: any, cohortId: string | number) {
  const cohort = await strapi.db.query('api::academy-cohort.academy-cohort').findOne({
    where: { id: cohortId },
    populate: { facilitator: { select: ['id'] }, course: true },
  });
  if (!cohort) return null;
  const user = ctx.state.user;
  if (user.role?.type === 'admin') return cohort;
  if (user.role?.type === 'facilitator') return cohort.facilitator?.id === user.id ? cohort : null;
  // student: must hold a non-removed enrollment in this cohort
  const enrollment = await strapi.db.query('api::academy-enrollment.academy-enrollment').findOne({
    where: { user: user.id, cohort: cohortId, removed: false },
  });
  return enrollment ? cohort : null;
}

// Shared by transferStudent/transferBulk: validates the move is legal before
// any enrollment is touched (same course only — a different course's
// curriculum makes currentDay/submittedDays meaningless — not into a
// Completed cohort, and not a same-cohort no-op).
async function resolveTransferTarget(strapi: any, sourceCohortId: string | number, targetCohortId: any) {
  if (!targetCohortId) return { error: 'targetCohortId is required.' as const };
  if (String(targetCohortId) === String(sourceCohortId)) {
    return { error: 'Target cohort must be different from the source cohort.' as const };
  }
  const sourceCohort = await strapi.db.query('api::academy-cohort.academy-cohort').findOne({
    where: { id: sourceCohortId },
    populate: { course: { select: ['id'] } },
  });
  if (!sourceCohort) return { error: 'Cohort not found.' as const, notFound: true };
  const targetCohort = await strapi.db.query('api::academy-cohort.academy-cohort').findOne({
    where: { id: targetCohortId },
    populate: { course: { select: ['id'] } },
  });
  if (!targetCohort) return { error: 'Target cohort not found.' as const, notFound: true };
  if (targetCohort.course?.id !== sourceCohort.course?.id) {
    return { error: 'Can only transfer to a cohort running the same course.' as const };
  }
  if (targetCohort.status === 'Completed') {
    return { error: 'Cannot transfer into a completed cohort.' as const };
  }
  return { sourceCohort, targetCohort };
}

// Re-derives currentDay against the target cohort's own releasedWeek/daysTotal
// (the same normalize() used everywhere else progression changes) rather than
// carrying the source cohort's pace over verbatim — the two cohorts can be at
// different points in the same curriculum. removed/shortlisted/earlyAccessRequested
// are cohort-relationship facts, not course progress, so they reset on a move.
async function moveEnrollmentToCohort(strapi: any, enrollment: any, targetCohort: any) {
  const state: ProgressionState = {
    currentDay: enrollment.currentDay,
    submittedDays: enrollment.submittedDays,
    releasedWeek: targetCohort.releasedWeek,
    earlyWeeks: enrollment.earlyWeeks,
  };
  const next = normalize(state, targetCohort.daysTotal);
  return strapi.db.query('api::academy-enrollment.academy-enrollment').update({
    where: { id: enrollment.id },
    data: {
      cohort: targetCohort.id,
      currentDay: next.currentDay,
      removed: false,
      shortlisted: false,
      earlyAccessRequested: false,
    },
  });
}

export default factories.createCoreController('api::academy-cohort.academy-cohort', ({ strapi }) => ({
  async find(ctx) {
    ctx.query = { ...ctx.query, populate: withFacilitatorPopulate(ctx.query.populate) };
    const result = await scopedFind(strapi, 'api::academy-cohort.academy-cohort', ctx, {});
    return { data: result.data.map(shapeFacilitator), meta: result.meta };
  },

  async findOne(ctx) {
    const { id } = ctx.params; // documentId, per Strapi v5's core route convention
    const cohort = await strapi.db.query('api::academy-cohort.academy-cohort').findOne({
      where: idOrDocumentIdWhere(id),
      populate: withFacilitatorPopulate(ctx.query.populate),
    });
    if (!cohort) return ctx.notFound();
    ctx.body = { data: shapeFacilitator(cohort) };
  },

  async delete(ctx) {
    const { id } = ctx.params; // documentId, per Strapi v5's core route convention
    const cohort = await strapi.documents('api::academy-cohort.academy-cohort').findOne({ documentId: id });
    if (!cohort) return ctx.notFound('Cohort not found.');

    const activeCount = await strapi.db.query('api::academy-enrollment.academy-enrollment').count({
      where: { cohort: cohort.id, removed: false },
    });
    if (activeCount > 0) {
      return ctx.badRequest('Remove or transfer all active students before deleting this cohort.');
    }

    // Sessions/teams aren't meaningful on their own once the cohort is gone —
    // cascade them. Enrollments are the thing being protected above, so they're
    // left untouched (any already-removed ones just lose their cohort link).
    await strapi.db.query('api::academy-live-session.academy-live-session').deleteMany({ where: { cohort: cohort.id } });
    await strapi.db.query('api::academy-team.academy-team').deleteMany({ where: { cohort: cohort.id } });

    await strapi.documents('api::academy-cohort.academy-cohort').delete({ documentId: id });
    await logActivity(strapi, { who: 'An admin', what: `deleted cohort "${cohort.name}"`, kind: 'gate-action' });
    ctx.status = 204;
    ctx.body = null;
  },

  async myCohorts(ctx) {
    const cohorts = await strapi.db.query('api::academy-cohort.academy-cohort').findMany({
      where: { facilitator: ctx.state.user.id },
      populate: { course: true, facilitator: FACILITATOR_SELECT },
    });
    ctx.body = { data: cohorts.map(shapeFacilitator) };
  },

  async roster(ctx) {
    const { id } = ctx.params;
    const enrollments = await strapi.db.query('api::academy-enrollment.academy-enrollment').findMany({
      where: { cohort: id, removed: false },
      populate: { user: { select: ['id', 'username', 'name'] } },
    });
    const cohort = await strapi.db.query('api::academy-cohort.academy-cohort').findOne({ where: { id } });

    ctx.body = {
      data: enrollments.map((e: any) => ({
        userId: e.user?.id,
        name: e.user?.name || e.user?.username,
        dayReached: e.currentDay,
        lastActive: timeAgo(e.updatedAt),
        standing: standingFor(e.currentDay, cohort?.releasedWeek ?? 0),
        shortlisted: e.shortlisted,
      })),
    };
  },

  async studentProfile(ctx) {
    const { id, uid } = ctx.params;
    const enrollment = await strapi.db.query('api::academy-enrollment.academy-enrollment').findOne({
      where: { cohort: id, user: uid },
      populate: { user: { select: ['id', 'username', 'name'] } },
    });
    if (!enrollment) return ctx.notFound('Student not enrolled in this cohort.');

    const submissions = await strapi.db.query('api::academy-submission.academy-submission').findMany({
      where: { enrollment: enrollment.id },
      orderBy: { day: 'desc' },
    });

    // Never populate `judge` here — facilitator/admin may see the
    // submission<->judgment mapping, but never which judge said what.
    const judgments = await strapi.db.query('api::academy-judgment.academy-judgment').findMany({
      where: { submission: { id: { $in: submissions.map((s: any) => s.id) } } },
      populate: { submission: { select: ['task', 'day'] } },
    });

    const cohort = await strapi.db.query('api::academy-cohort.academy-cohort').findOne({ where: { id } });

    ctx.body = {
      data: {
        userId: enrollment.user?.id,
        name: enrollment.user?.name || enrollment.user?.username,
        dayReached: enrollment.currentDay,
        standing: standingFor(enrollment.currentDay, cohort?.releasedWeek ?? 0),
        submissions: submissions.map((s: any) => ({
          day: s.day,
          task: s.task,
          url: s.url,
          submittedAgo: timeAgo(s.submittedAt),
          rated: s.rated,
        })),
        judgments: judgments.map((j: any) => ({
          task: j.submission?.task,
          brief: j.brief,
          craft: j.craft,
          originality: j.originality,
          average: j.average,
          feedback: j.feedback,
        })),
      },
    };
  },

  async topRated(ctx) {
    const { id } = ctx.params;
    const enrollments = await strapi.db.query('api::academy-enrollment.academy-enrollment').findMany({
      where: { cohort: id, removed: false },
      populate: { user: { select: ['id', 'username', 'name'] } },
    });

    const rows = await Promise.all(
      enrollments.map(async (e: any) => {
        const submissions = await strapi.db.query('api::academy-submission.academy-submission').findMany({
          where: { enrollment: e.id },
          select: ['id'],
        });
        const judgments = await strapi.db.query('api::academy-judgment.academy-judgment').findMany({
          where: { submission: { id: { $in: submissions.map((s: any) => s.id) } } },
          select: ['average'],
        });
        const avg = judgments.length
          ? Math.round((judgments.reduce((a: number, j: any) => a + j.average, 0) / judgments.length) * 10) / 10
          : 0;
        return { userId: e.user?.id, name: e.user?.name || e.user?.username, avgScore: avg };
      }),
    );

    ctx.body = { data: rows.filter((r) => r.avgScore > 0).sort((a, b) => b.avgScore - a.avgScore) };
  },

  async shortlistToggle(ctx) {
    const { id, uid } = ctx.params;
    const enrollment = await strapi.db.query('api::academy-enrollment.academy-enrollment').findOne({
      where: { cohort: id, user: uid },
    });
    if (!enrollment) return ctx.notFound('Student not enrolled in this cohort.');
    const updated = await strapi.db.query('api::academy-enrollment.academy-enrollment').update({
      where: { id: enrollment.id },
      data: { shortlisted: !enrollment.shortlisted },
    });
    ctx.body = { data: { shortlisted: updated.shortlisted } };
  },

  async removeStudent(ctx) {
    const { id, uid } = ctx.params;
    const enrollment = await strapi.db.query('api::academy-enrollment.academy-enrollment').findOne({
      where: { cohort: id, user: uid },
    });
    if (!enrollment) return ctx.notFound('Student not enrolled in this cohort.');
    await strapi.db.query('api::academy-enrollment.academy-enrollment').update({
      where: { id: enrollment.id },
      data: { removed: true, shortlisted: false },
    });
    await logActivity(strapi, { who: 'A facilitator', what: 'removed a student from the roster', kind: 'gate-action' });
    ctx.body = { data: { removed: true } };
  },

  async restoreStudent(ctx) {
    const { id, uid } = ctx.params;
    const enrollment = await strapi.db.query('api::academy-enrollment.academy-enrollment').findOne({
      where: { cohort: id, user: uid },
    });
    if (!enrollment) return ctx.notFound('Student not enrolled in this cohort.');
    await strapi.db.query('api::academy-enrollment.academy-enrollment').update({
      where: { id: enrollment.id },
      data: { removed: false },
    });
    ctx.body = { data: { removed: false } };
  },

  async transferStudent(ctx) {
    const { id, uid } = ctx.params;
    const { targetCohortId } = (ctx.request.body as any) || {};

    const resolved = await resolveTransferTarget(strapi, id, targetCohortId);
    if (resolved.error) return resolved.notFound ? ctx.notFound(resolved.error) : ctx.badRequest(resolved.error);
    const { sourceCohort, targetCohort } = resolved;

    const enrollment = await strapi.db.query('api::academy-enrollment.academy-enrollment').findOne({
      where: { cohort: id, user: uid },
    });
    if (!enrollment) return ctx.notFound('Student not enrolled in this cohort.');

    const duplicate = await strapi.db.query('api::academy-enrollment.academy-enrollment').findOne({
      where: { user: uid, cohort: targetCohort.id },
    });
    if (duplicate) return ctx.badRequest('Student already has an enrollment in the target cohort.');

    const updated = await moveEnrollmentToCohort(strapi, enrollment, targetCohort);
    await logActivity(strapi, {
      who: 'A facilitator',
      what: `transferred a student from "${sourceCohort.name}" to "${targetCohort.name}"`,
      kind: 'gate-action',
    });
    ctx.body = { data: { cohortId: targetCohort.id, currentDay: updated.currentDay } };
  },

  async transferBulk(ctx) {
    const { id } = ctx.params;
    const { userIds, targetCohortId } = (ctx.request.body as any) || {};
    if (!Array.isArray(userIds) || !userIds.length) return ctx.badRequest('userIds[] is required.');

    const resolved = await resolveTransferTarget(strapi, id, targetCohortId);
    if (resolved.error) return resolved.notFound ? ctx.notFound(resolved.error) : ctx.badRequest(resolved.error);
    const { sourceCohort, targetCohort } = resolved;

    const enrollments = await strapi.db.query('api::academy-enrollment.academy-enrollment').findMany({
      where: { cohort: id, user: { id: { $in: userIds } } },
      populate: { user: { select: ['id'] } },
    });

    let transferredCount = 0;
    const skippedUserIds: number[] = [];
    for (const e of enrollments) {
      if (!e.user) continue; // corrupted row (no user) — nothing to transfer
      const duplicate = await strapi.db.query('api::academy-enrollment.academy-enrollment').findOne({
        where: { user: e.user.id, cohort: targetCohort.id },
      });
      if (duplicate) {
        skippedUserIds.push(e.user.id);
        continue;
      }
      await moveEnrollmentToCohort(strapi, e, targetCohort);
      transferredCount++;
    }

    await logActivity(strapi, {
      who: 'A facilitator',
      what: `transferred ${transferredCount} students from "${sourceCohort.name}" to "${targetCohort.name}"`,
      kind: 'gate-action',
    });
    ctx.body = { data: { transferredCount, skippedUserIds } };
  },

  async removeBulk(ctx) {
    const { id } = ctx.params;
    const { userIds } = (ctx.request.body as any) || {};
    if (!Array.isArray(userIds) || !userIds.length) return ctx.badRequest('userIds[] is required.');

    const enrollments = await strapi.db.query('api::academy-enrollment.academy-enrollment').findMany({
      where: { cohort: id, user: { id: { $in: userIds } } },
    });
    for (const e of enrollments) {
      await strapi.db.query('api::academy-enrollment.academy-enrollment').update({
        where: { id: e.id },
        data: { removed: true, shortlisted: false },
      });
    }
    await logActivity(strapi, {
      who: 'A facilitator',
      what: `removed ${enrollments.length} students at the gate`,
      kind: 'gate-action',
    });
    ctx.body = { data: { removedCount: enrollments.length } };
  },

  async getThreshold(ctx) {
    const { id } = ctx.params;
    const cohort = await strapi.db.query('api::academy-cohort.academy-cohort').findOne({ where: { id } });
    if (!cohort) return ctx.notFound('Cohort not found.');
    ctx.body = { data: { minCompletion: cohort.minCompletion, checkWeeks: cohort.checkWeeks } };
  },

  async putThreshold(ctx) {
    const { id } = ctx.params;
    const { minCompletion, checkWeeks } = (ctx.request.body as any) || {};
    const updated = await strapi.db.query('api::academy-cohort.academy-cohort').update({
      where: { id },
      data: { minCompletion, checkWeeks },
    });
    ctx.body = { data: { minCompletion: updated.minCompletion, checkWeeks: updated.checkWeeks } };
  },

  async rolloutNextWeek(ctx) {
    const { id } = ctx.params;
    const cohort = await strapi.db.query('api::academy-cohort.academy-cohort').findOne({ where: { id } });
    if (!cohort) return ctx.notFound('Cohort not found.');
    const updated = await strapi
      .service('api::academy-cohort.academy-cohort')
      .rolloutToWeek(Number(id), cohort.releasedWeek + 1);
    ctx.body = { data: { releasedWeek: updated.releasedWeek } };
  },

  async earlyAccessRequests(ctx) {
    const { id } = ctx.params;
    const enrollments = await strapi.db.query('api::academy-enrollment.academy-enrollment').findMany({
      where: { cohort: id, earlyAccessRequested: true, removed: false },
      populate: { user: { select: ['id', 'username', 'name'] } },
    });
    ctx.body = {
      data: enrollments.map((e: any) => ({
        enrollmentId: e.id,
        userId: e.user?.id,
        name: e.user?.name || e.user?.username,
        currentDay: e.currentDay,
      })),
    };
  },

  async sessionsFind(ctx) {
    const { id } = ctx.params;
    const cohort = await assertCohortVisible(strapi, ctx, id);
    if (!cohort) return ctx.forbidden();
    const sessions = await strapi.db.query('api::academy-live-session.academy-live-session').findMany({
      where: { cohort: id },
    });
    ctx.body = { data: sessions };
  },

  async sessionsCreate(ctx) {
    const { id } = ctx.params;
    const { title, type, day, time, host, link } = (ctx.request.body as any) || {};
    if (!title || !type || !day || !time || !host) return ctx.badRequest('title, type, day, time, host are required.');
    const session = await strapi.db.query('api::academy-live-session.academy-live-session').create({
      data: { cohort: id, title, type, day, time, host, link },
    });
    ctx.body = { data: session };
  },

  async teamsMatch(ctx) {
    const { id } = ctx.params;
    const { teamSize, title } = (ctx.request.body as any) || {};
    const size = Number(teamSize) || 3;

    const cohort = await strapi.db.query('api::academy-cohort.academy-cohort').findOne({ where: { id } });
    if (!cohort) return ctx.notFound('Cohort not found.');

    await strapi.db.query('api::academy-team.academy-team').deleteMany({ where: { cohort: id } });

    const enrollments = await strapi.db.query('api::academy-enrollment.academy-enrollment').findMany({
      where: { cohort: id, removed: false },
      populate: { user: { select: ['id'] } },
    });
    // A user-less enrollment is corrupted data (the relation is required at
    // the API layer, but a raw db write can still produce one) — skip it
    // rather than crash team matching for the whole cohort over one bad row.
    const groups = chunk(
      enrollments.filter((e: any) => e.user).map((e: any) => e.user.id),
      size
    );
    const week = cohort.releasedWeek || 1;
    const groupTitle = title || `Week ${week} group project`;

    const teams = await Promise.all(
      groups.map((memberIds) =>
        strapi.db.query('api::academy-team.academy-team').create({
          data: { cohort: id, week, title: groupTitle, members: memberIds },
        }),
      ),
    );

    await logActivity(strapi, { who: 'A facilitator', what: `matched ${teams.length} teams`, kind: 'team-match' });
    ctx.body = { data: teams };
  },

  async teamsCreate(ctx) {
    const { id } = ctx.params;
    const { title, week, memberUserIds } = (ctx.request.body as any) || {};
    if (!title) return ctx.badRequest('title is required.');
    if (!Array.isArray(memberUserIds) || !memberUserIds.length) return ctx.badRequest('memberUserIds[] is required.');

    const cohort = await strapi.db.query('api::academy-cohort.academy-cohort').findOne({ where: { id } });
    if (!cohort) return ctx.notFound('Cohort not found.');

    // A user can't be on two teams in the same cohort at once.
    const existingTeams = await strapi.db.query('api::academy-team.academy-team').findMany({
      where: { cohort: id, members: { id: { $in: memberUserIds } } },
      populate: { members: { select: ['id'] } },
    });
    const conflictingUserIds = new Set<number>();
    for (const t of existingTeams) {
      for (const m of t.members) {
        if (memberUserIds.includes(m.id)) conflictingUserIds.add(m.id);
      }
    }
    if (conflictingUserIds.size) {
      return ctx.badRequest(
        `These students are already on another team in this cohort: ${[...conflictingUserIds].join(', ')}`
      );
    }

    const team = await strapi.db.query('api::academy-team.academy-team').create({
      data: { cohort: id, week: week || cohort.releasedWeek || 1, title, members: memberUserIds },
      populate: { members: { select: ['id', 'username', 'name', 'email', 'whatsapp'] } },
    });
    await logActivity(strapi, { who: 'A facilitator', what: `created team "${title}"`, kind: 'team-match' });
    ctx.body = {
      data: {
        id: team.id,
        week: team.week,
        title: team.title,
        members: team.members.map((m: any) => ({ id: m.id, name: m.name || m.username, email: m.email, whatsapp: m.whatsapp })),
      },
    };
  },

  async teamsClear(ctx) {
    const { id } = ctx.params;
    await strapi.db.query('api::academy-team.academy-team').deleteMany({ where: { cohort: id } });
    await logActivity(strapi, { who: 'A facilitator', what: 'cleared teams', kind: 'team-match' });
    ctx.body = { data: { cleared: true } };
  },

  async teamsGet(ctx) {
    const { id } = ctx.params;
    const teams = await strapi.db.query('api::academy-team.academy-team').findMany({
      where: { cohort: id },
      populate: { members: { select: ['id', 'username', 'name', 'email', 'whatsapp'] } },
    });
    ctx.body = {
      data: teams.map((t: any) => ({
        id: t.id,
        week: t.week,
        title: t.title,
        members: t.members.map((m: any) => ({ id: m.id, name: m.name || m.username, email: m.email, whatsapp: m.whatsapp })),
      })),
    };
  },
}));
