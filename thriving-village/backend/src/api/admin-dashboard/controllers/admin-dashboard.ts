let statsCache: { data: any; expiresAt: number } | null = null;
const TTL_MS = 90_000;

export default {
  async stats(ctx: any) {
    if (statsCache && statsCache.expiresAt > Date.now()) {
      ctx.body = { data: statsCache.data };
      return;
    }

    const weekAgo = new Date(Date.now() - 7 * 86400000);

    const [users, usersLastWeek, applications, applicationsLastWeek, enrollments, contestsLive] =
      await Promise.all([
        strapi.db.query('plugin::users-permissions.user').count(),
        strapi.db.query('plugin::users-permissions.user').count({ where: { createdAt: { $gte: weekAgo } } }),
        strapi.db.query('api::job-application.job-application').count(),
        strapi.db
          .query('api::job-application.job-application')
          .count({ where: { createdAt: { $gte: weekAgo } } }),
        strapi.db.query('api::enrollment.enrollment').count(),
        strapi.db.query('api::contest.contest').count({ where: { status: 'live' } }),
      ]);

    const data = [
      { label: 'Total users', value: String(users), delta: `+${usersLastWeek} this week` },
      { label: 'Applications', value: String(applications), delta: `+${applicationsLastWeek} this week` },
      { label: 'Enrollments', value: String(enrollments), delta: '' },
      { label: 'Active contests', value: String(contestsLive), delta: '' },
    ];

    statsCache = { data, expiresAt: Date.now() + TTL_MS };
    ctx.body = { data };
  },

  async activity(ctx: any) {
    const rows = await strapi.db.query('api::activity-log.activity-log').findMany({
      orderBy: { occurredAt: 'desc' },
      limit: 6,
    });
    ctx.body = {
      data: rows.map((r: any) => ({ who: r.who, what: r.what, when: r.occurredAt })),
    };
  },
};
