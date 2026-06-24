type Strapi = any;

const ROLES: Array<{ type: string; name: string; description: string }> = [
  { type: 'talent', name: 'Talent', description: 'Signed-up community member applying/entering/enrolling.' },
  { type: 'employer', name: 'Employer', description: 'Signed-up employer/brand account. Same access as Talent for now.' },
  { type: 'admin', name: 'Admin', description: 'Community admin: full catalog CRUD + dashboard access.' },
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
  admin: ADMIN_ACTIONS,
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
  admin: ['plugin::users-permissions.user.me'],
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
