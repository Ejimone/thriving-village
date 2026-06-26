type Strapi = any;

const ROLES: Array<{ type: string; name: string; description: string }> = [
  { type: 'talent', name: 'Talent', description: 'Signed-up community member applying/entering/enrolling.' },
  { type: 'employer', name: 'Employer', description: 'Signed-up employer/brand account. Same access as Talent for now.' },
  { type: 'admin', name: 'Admin', description: 'Community admin: full catalog CRUD + dashboard access. Also full Academy access.' },
  { type: 'student', name: 'Student', description: 'Academy learner: enrolled in cohorts, submits daily work.' },
  { type: 'facilitator', name: 'Facilitator', description: 'Academy facilitator: runs their own cohorts only.' },
  { type: 'judge', name: 'Judge', description: 'Academy judge: rates anonymized submissions only.' },
];

const PUBLIC_READ = [
  'api::job.job.find',
  'api::job.job.findOne',
  'api::job.job.stream',
  'api::contest.contest.find',
  'api::contest.contest.findOne',
  'api::contest.contest.leaderboard',
  'api::course.course.find',
  'api::course.course.findOne',
  'api::product.product.find',
  'api::product.product.findOne',
  'api::brand.brand.find',
  'api::brand.brand.findOne',
  'api::testimonial.testimonial.find',
  'api::testimonial.testimonial.findOne',
];

// Academy catalogue browsing + certificate verification are intentionally
// public (pre-signup browsing, publicly-verifiable certificates) — folded
// into PUBLIC_READ so talent/employer (which spread PUBLIC_READ) get it too.
const ACADEMY_PUBLIC = [
  'api::academy-category.academy-category.find',
  'api::academy-category.academy-category.findOne',
  'api::academy-course.academy-course.find',
  'api::academy-course.academy-course.findOne',
  'api::academy-course.academy-course.curriculum',
  'api::academy-certificate.academy-certificate.verify',
];
PUBLIC_READ.push(...ACADEMY_PUBLIC);

// The Mux webhook is unauthenticated by route config (`auth: false`) — Mux's
// own signature check inside the handler is the real security boundary, not
// this permission grant — but it still needs to be reachable by an anonymous
// caller, so it's granted to `public` like the plugin's own register route.
PUBLIC_READ.push('api::mux-webhook.mux-webhook.handle');

const ACADEMY_STUDENT_ACTIONS = [
  ...ACADEMY_PUBLIC,
  'api::academy-enrollment.academy-enrollment.find',
  'api::academy-enrollment.academy-enrollment.findOne',
  'api::academy-enrollment.academy-enrollment.submitTask',
  'api::academy-enrollment.academy-enrollment.listSubmissions',
  'api::academy-enrollment.academy-enrollment.requestEarlyAccess',
  'api::academy-enrollment.academy-enrollment.team',
  'api::academy-material.academy-material.find',
  'api::academy-material.academy-material.getPlaybackToken',
  'api::academy-cohort.academy-cohort.sessionsFind',
  'api::me.me.whoami',
];

const ACADEMY_FACILITATOR_ACTIONS = [
  ...ACADEMY_PUBLIC,
  'api::academy-cohort.academy-cohort.myCohorts',
  'api::academy-cohort.academy-cohort.roster',
  'api::academy-cohort.academy-cohort.studentProfile',
  'api::academy-cohort.academy-cohort.topRated',
  'api::academy-cohort.academy-cohort.shortlistToggle',
  'api::academy-cohort.academy-cohort.removeStudent',
  'api::academy-cohort.academy-cohort.restoreStudent',
  'api::academy-cohort.academy-cohort.removeBulk',
  'api::academy-cohort.academy-cohort.transferStudent',
  'api::academy-cohort.academy-cohort.transferBulk',
  'api::academy-cohort.academy-cohort.getThreshold',
  'api::academy-cohort.academy-cohort.putThreshold',
  'api::academy-cohort.academy-cohort.rolloutNextWeek',
  'api::academy-cohort.academy-cohort.earlyAccessRequests',
  'api::academy-cohort.academy-cohort.sessionsFind',
  'api::academy-cohort.academy-cohort.sessionsCreate',
  'api::academy-cohort.academy-cohort.teamsMatch',
  'api::academy-cohort.academy-cohort.teamsCreate',
  'api::academy-cohort.academy-cohort.teamsClear',
  'api::academy-cohort.academy-cohort.teamsGet',
  'api::academy-team.academy-team.renameTeam',
  'api::academy-team.academy-team.deleteTeam',
  'api::academy-team.academy-team.addMember',
  'api::academy-team.academy-team.removeMember',
  'api::academy-cohort.academy-cohort.rosterRequestCreate',
  'api::academy-cohort.academy-cohort.rosterRequestsFind',
  'api::academy-enrollment.academy-enrollment.grantEarlyAccess',
  'api::academy-material.academy-material.find',
  'api::me.me.whoami',
];

const ACADEMY_JUDGE_ACTIONS = [
  'api::academy-submission.academy-submission.judgeQueue',
  'api::academy-submission.academy-submission.rate',
  'api::me.me.whoami',
];

const ACADEMY_ADMIN_EXTRA_ACTIONS = [
  ...ACADEMY_PUBLIC,
  'api::academy-category.academy-category.create',
  'api::academy-category.academy-category.update',
  'api::academy-category.academy-category.delete',
  'api::academy-course.academy-course.create',
  'api::academy-course.academy-course.update',
  'api::academy-course.academy-course.delete',
  'api::academy-material.academy-material.find',
  'api::academy-material.academy-material.put',
  'api::academy-material.academy-material.delete',
  'api::academy-material.academy-material.muxUploadUrl',
  'api::academy-material.academy-material.getPlaybackToken',
  'api::academy-cohort.academy-cohort.find',
  'api::academy-cohort.academy-cohort.findOne',
  'api::academy-cohort.academy-cohort.create',
  'api::academy-cohort.academy-cohort.update',
  'api::academy-cohort.academy-cohort.delete',
  'api::academy-enrollment.academy-enrollment.find',
  'api::academy-enrollment.academy-enrollment.findOne',
  'api::academy-enrollment.academy-enrollment.create',
  'api::academy-enrollment.academy-enrollment.update',
  'api::academy-enrollment.academy-enrollment.delete',
  ...ACADEMY_FACILITATOR_ACTIONS.filter((a) => !ACADEMY_PUBLIC.includes(a)),
  'api::academy-admin.academy-admin.overview',
  'api::academy-admin.academy-admin.topRated',
  'api::academy-admin.academy-admin.activity',
  'api::academy-admin.academy-admin.users',
  'api::academy-admin.academy-admin.createUser',
  'api::academy-admin.academy-admin.updateUserRole',
  'api::academy-admin.academy-admin.rosterRequests',
  'api::academy-roster-request.academy-roster-request.updateStatus',
];

const TALENT_ACTIONS = [
  ...PUBLIC_READ,
  'api::job.job.apply',
  'api::contest.contest.enter',
  'api::course.course.enroll',
  'api::lesson-progress.lesson-progress.mark',
  'api::saved-job.saved-job.find',
  'api::saved-job.saved-job.save',
  'api::saved-job.saved-job.unsave',
  'api::job-application.job-application.find',
  'api::job-application.job-application.findOne',
  'api::contest-entry.contest-entry.find',
  'api::contest-entry.contest-entry.findOne',
  'api::enrollment.enrollment.find',
  'api::enrollment.enrollment.findOne',
  'api::me.me.whoami',
  'api::me.me.applications',
  'api::me.me.entries',
  'api::me.me.courses',
];

const ADMIN_ACTIONS = [
  ...PUBLIC_READ,
  'api::job.job.create',
  'api::job.job.update',
  'api::job.job.delete',
  'api::contest.contest.create',
  'api::contest.contest.update',
  'api::contest.contest.delete',
  'api::course.course.create',
  'api::course.course.update',
  'api::course.course.delete',
  'api::product.product.create',
  'api::product.product.update',
  'api::product.product.delete',
  'api::brand.brand.create',
  'api::brand.brand.update',
  'api::brand.brand.delete',
  'api::testimonial.testimonial.create',
  'api::testimonial.testimonial.update',
  'api::testimonial.testimonial.delete',
  'api::job-application.job-application.find',
  'api::job-application.job-application.findOne',
  'api::job-application.job-application.update',
  'api::contest-entry.contest-entry.find',
  'api::contest-entry.contest-entry.findOne',
  'api::contest-entry.contest-entry.update',
  'api::enrollment.enrollment.find',
  'api::enrollment.enrollment.findOne',
  'api::lesson-progress.lesson-progress.find',
  'api::lesson-progress.lesson-progress.findOne',
  'api::activity-log.activity-log.find',
  'api::activity-log.activity-log.findOne',
  'api::me.me.whoami',
  'api::admin-dashboard.admin-dashboard.stats',
  'api::admin-dashboard.admin-dashboard.activity',
  'api::admin-dashboard.admin-dashboard.stream',
];

const ROLE_ACTIONS: Record<string, string[]> = {
  public: PUBLIC_READ,
  talent: TALENT_ACTIONS,
  employer: TALENT_ACTIONS,
  // Academy admin reuses the main-site admin role — one platform-admin login
  // gets full access to both domains (confirmed product decision).
  admin: [...ADMIN_ACTIONS, ...ACADEMY_ADMIN_EXTRA_ACTIONS],
  student: ACADEMY_STUDENT_ACTIONS,
  facilitator: ACADEMY_FACILITATOR_ACTIONS,
  judge: ACADEMY_JUDGE_ACTIONS,
};

// Plugin-owned actions (login, register, "who am I") that must stay available
// regardless of our api::* permission sync — never deleted, only ensured present.
const PLUGIN_ESSENTIALS: Record<string, string[]> = {
  public: [
    'plugin::users-permissions.auth.callback',
    'plugin::users-permissions.auth.register',
    'plugin::users-permissions.auth.forgotPassword',
    'plugin::users-permissions.auth.resetPassword',
    'plugin::users-permissions.auth.emailConfirmation',
  ],
  talent: ['plugin::users-permissions.user.me'],
  employer: ['plugin::users-permissions.user.me'],
  // `.user.find` is required for admin to write any relation field that targets
  // plugin::users-permissions.user (e.g. academy-cohort.facilitator,
  // academy-enrollment.user) — Strapi's core create/update actions check the
  // caller has `find` on a relation's target type before allowing the write,
  // throwing "Invalid key <field>" otherwise. Not granted to other roles since
  // it also backs GET /api/users (full user enumeration).
  admin: ['plugin::users-permissions.user.me', 'plugin::users-permissions.user.find'],
  student: ['plugin::users-permissions.user.me'],
  facilitator: ['plugin::users-permissions.user.me'],
  judge: ['plugin::users-permissions.user.me'],
};

async function ensureRole(strapi: Strapi, role: { type: string; name: string; description: string }) {
  const existing = await strapi.db.query('plugin::users-permissions.role').findOne({
    where: { type: role.type },
  });
  if (existing) return existing;
  return strapi.db.query('plugin::users-permissions.role').create({ data: role });
}

// Strapi v5 stores permission->role via a link table (up_permissions_role_lnk), not a
// role_id column, and createMany/deleteMany don't run the relation attach/cleanup step
// that create()/delete() do (acknowledged TODO in @strapi/database's entity-manager) —
// using them here would silently orphan or leave dangling relations. So we keep the
// relation-safe single-row create()/delete() calls, but fire each chunk concurrently
// instead of awaiting one at a time, which is where nearly all of the wall-clock cost was.
const WRITE_CONCURRENCY = 25;

async function createPermissionsBatched(strapi: Strapi, roleId: number, actions: string[]) {
  for (let i = 0; i < actions.length; i += WRITE_CONCURRENCY) {
    const chunk = actions.slice(i, i + WRITE_CONCURRENCY);
    await Promise.all(
      chunk.map((action) =>
        strapi.db.query('plugin::users-permissions.permission').create({ data: { action, role: roleId } })
      )
    );
  }
}

async function deletePermissionsBatched(strapi: Strapi, ids: number[]) {
  for (let i = 0; i < ids.length; i += WRITE_CONCURRENCY) {
    const chunk = ids.slice(i, i + WRITE_CONCURRENCY);
    await Promise.all(
      chunk.map((id) => strapi.db.query('plugin::users-permissions.permission').delete({ where: { id } }))
    );
  }
}

async function ensurePluginPermissions(strapi: Strapi, roleType: string, actions: string[]) {
  const role = await strapi.db.query('plugin::users-permissions.role').findOne({
    where: { type: roleType },
    populate: ['permissions'],
  });
  if (!role) return;
  const existing = new Set((role.permissions || []).map((p: any) => p.action));
  const toCreate = actions.filter((action) => !existing.has(action));
  await createPermissionsBatched(strapi, role.id, toCreate);
}

async function syncPermissions(strapi: Strapi, roleType: string, allowedActions: string[]) {
  const role = await strapi.db.query('plugin::users-permissions.role').findOne({
    where: { type: roleType },
    populate: ['permissions'],
  });
  if (!role) return;

  // In Strapi v5's users-permissions plugin, the permission content-type has no
  // `enabled` field — a row's mere existence for (action, role) grants it.
  // Only manage api::* (and our controller-only api::me / api::admin-dashboard)
  // actions here — plugin::* actions (login/register/etc.) are handled by
  // ensurePluginPermissions and must never be touched/deleted by this function.
  const allowed = new Set(allowedActions);
  const existingByAction = new Map<string, any>(
    (role.permissions || [])
      .filter((p: any) => p.action.startsWith('api::'))
      .map((p: any) => [p.action, p])
  );

  const toCreate = Array.from(allowed).filter((action) => !existingByAction.has(action));
  await createPermissionsBatched(strapi, role.id, toCreate);

  // remove anything previously granted that is no longer in the allow-list
  const idsToDelete = Array.from(existingByAction.values())
    .filter((perm) => !allowed.has(perm.action))
    .map((perm) => perm.id);
  await deletePermissionsBatched(strapi, idsToDelete);
}

export default {
  register() {},

  async bootstrap({ strapi }: { strapi: Strapi }) {
    for (const role of ROLES) {
      await ensureRole(strapi, role);
    }
    for (const [roleType, actions] of Object.entries(PLUGIN_ESSENTIALS)) {
      await ensurePluginPermissions(strapi, roleType, actions);
    }
    for (const [roleType, actions] of Object.entries(ROLE_ACTIONS)) {
      await syncPermissions(strapi, roleType, actions);
    }
  },
};
