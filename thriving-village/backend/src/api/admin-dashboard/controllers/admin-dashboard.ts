import { cached } from '../../../utils/cache';

export default {
  async stats(ctx: any) {
    const data = await cached('admin-dashboard:stats', 'v1', 90, async () => {
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

      return [
        { label: 'Total users', value: String(users), delta: `+${usersLastWeek} this week` },
        { label: 'Applications', value: String(applications), delta: `+${applicationsLastWeek} this week` },
        { label: 'Enrollments', value: String(enrollments), delta: '' },
        { label: 'Active contests', value: String(contestsLive), delta: '' },
      ];
    });

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

  // Server-Sent Events stream of new activity (job applications, contest entries, course
  // enrollments) — pushed instantly via strapi.eventHub instead of the admin dashboard having
  // to poll. Gated to Admin purely through the permission table, same as stats/activity above.
  async stream(ctx: any) {
    ctx.request.socket.setTimeout(0);
    ctx.res.setHeader('Content-Type', 'text/event-stream');
    ctx.res.setHeader('Cache-Control', 'no-cache');
    ctx.res.setHeader('Connection', 'keep-alive');
    ctx.res.setHeader('X-Accel-Buffering', 'no');
    ctx.status = 200;
    ctx.respond = false; // hand the response off to us — Koa won't try to write/close it itself

    const send = (event: string, data: unknown) => {
      ctx.res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
    };
    send('connected', { ok: true });

    const unsubscribe = strapi.eventHub.on('tv.activity', async (payload: unknown) => {
      send('activity', payload);
    });

    const heartbeat = setInterval(() => ctx.res.write(': ping\n\n'), 20_000);

    ctx.req.on('close', () => {
      clearInterval(heartbeat);
      unsubscribe();
      ctx.res.end();
    });
  },
};
