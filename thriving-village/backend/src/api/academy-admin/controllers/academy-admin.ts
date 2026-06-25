import { cached } from '../../../utils/cache';

const ACADEMY_KINDS = ['rollout', 'early-access', 'gate-action', 'judgment', 'team-match', 'certificate-issued'];
const ACADEMY_ROLES = ['Student', 'Facilitator', 'Judge', 'Admin'];

export default {
  async overview(ctx: any) {
    const data = await cached('academy-admin:overview', 'v1', 90, async () => {
      const [categories, courses, cohorts, students] = await Promise.all([
        strapi.db.query('api::academy-category.academy-category').count(),
        strapi.db.query('api::academy-course.academy-course').count(),
        strapi.db.query('api::academy-cohort.academy-cohort').count(),
        strapi.db.query('api::academy-enrollment.academy-enrollment').count({ where: { removed: false } }),
      ]);
      return [
        { label: 'Categories', value: String(categories) },
        { label: 'Courses', value: String(courses) },
        { label: 'Active cohorts', value: String(cohorts) },
        { label: 'Students enrolled', value: String(students) },
      ];
    });
    ctx.body = { data };
  },

  async topRated(ctx: any) {
    const judgments = await strapi.db.query('api::academy-judgment.academy-judgment').findMany({
      populate: { submission: { populate: { enrollment: { populate: { user: { select: ['id', 'username', 'name'] } } } } } },
    });

    const byUser = new Map<number, { name: string; total: number; count: number }>();
    for (const j of judgments) {
      const user = j.submission?.enrollment?.user;
      if (!user) continue;
      const entry = byUser.get(user.id) || { name: user.name || user.username, total: 0, count: 0 };
      entry.total += j.average;
      entry.count += 1;
      byUser.set(user.id, entry);
    }

    const rows = Array.from(byUser.entries())
      .map(([userId, e]) => ({ userId, name: e.name, avgScore: Math.round((e.total / e.count) * 10) / 10 }))
      .sort((a, b) => b.avgScore - a.avgScore)
      .slice(0, 10);

    ctx.body = { data: rows };
  },

  async activity(ctx: any) {
    const rows = await strapi.db.query('api::activity-log.activity-log').findMany({
      where: { kind: { $in: ACADEMY_KINDS } },
      orderBy: { occurredAt: 'desc' },
      limit: 10,
    });
    ctx.body = { data: rows.map((r: any) => ({ who: r.who, what: r.what, when: r.occurredAt })) };
  },

  // Name-searchable picker backing admin forms (assign a facilitator to a
  // cohort, enroll a student) — replaces raw "type a user ID" inputs.
  async users(ctx: any) {
    const { role, search } = ctx.query as { role?: string; search?: string };
    if (!role || !ACADEMY_ROLES.includes(role)) {
      return ctx.badRequest(`role is required and must be one of: ${ACADEMY_ROLES.join(', ')}`);
    }

    const where: any = { role: { type: role.toLowerCase() } };
    if (search) where.name = { $containsi: search };

    const users = await strapi.db.query('plugin::users-permissions.user').findMany({
      where,
      select: ['id', 'name', 'username', 'email', 'whatsapp'],
      orderBy: { name: 'asc' },
    });
    ctx.body = {
      data: users.map((u: any) => ({ id: u.id, name: u.name || u.username, email: u.email, whatsapp: u.whatsapp })),
    };
  },
};
