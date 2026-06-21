const timeAgo = (date: string | Date): string => {
  const ms = Date.now() - new Date(date).getTime();
  const days = Math.floor(ms / 86400000);
  if (days <= 0) return 'today';
  if (days === 1) return '1 day ago';
  if (days < 7) return `${days} days ago`;
  const weeks = Math.floor(days / 7);
  if (weeks < 5) return weeks === 1 ? '1 week ago' : `${weeks} weeks ago`;
  const months = Math.floor(days / 30);
  return months <= 1 ? '1 month ago' : `${months} months ago`;
};

export default {
  // /api/users/me strips the `role` relation from content-API output even
  // with ?populate=role (Strapi restricts exposing relations into the
  // plugin::users-permissions.user/role models over the public API).
  // ctx.state.user already has role populated by the JWT auth strategy, so
  // this sidesteps that restriction for the one thing the frontend actually
  // needs: which role to gate /admin/** on.
  async whoami(ctx: any) {
    const user = ctx.state.user;
    ctx.body = { data: { id: user.id, email: user.email, role: user.role?.name } };
  },

  async applications(ctx: any) {
    const userId = ctx.state.user.id;
    const rows = await strapi.db.query('api::job-application.job-application').findMany({
      where: { user: userId },
      populate: { job: true },
      orderBy: { createdAt: 'desc' },
    });
    ctx.body = {
      data: rows.map((r: any) => ({
        jobId: r.job?.slug,
        status: r.status,
        appliedAgo: timeAgo(r.createdAt),
      })),
    };
  },

  async entries(ctx: any) {
    const userId = ctx.state.user.id;
    const rows = await strapi.db.query('api::contest-entry.contest-entry').findMany({
      where: { user: userId },
      populate: { contest: true },
      orderBy: { createdAt: 'desc' },
    });
    ctx.body = {
      data: rows.map((r: any) => ({
        contestId: r.contest?.slug,
        status: r.status,
        submittedAgo: timeAgo(r.createdAt),
      })),
    };
  },

  async courses(ctx: any) {
    const userId = ctx.state.user.id;
    const enrollments = await strapi.db.query('api::enrollment.enrollment').findMany({
      where: { user: userId },
      populate: { course: { populate: { modules: { populate: ['lessons'] } } } },
      orderBy: { createdAt: 'desc' },
    });

    const progressRows = await strapi.db.query('api::lesson-progress.lesson-progress').findMany({
      where: { user: userId },
      populate: { course: { select: ['id'] } },
    });
    const completedByCourse = new Map<number, Set<string>>();
    for (const p of progressRows) {
      const courseId = p.course?.id;
      const set = completedByCourse.get(courseId) || new Set<string>();
      set.add(p.lessonKey);
      completedByCourse.set(courseId, set);
    }

    ctx.body = {
      data: enrollments.map((e: any) => {
        const totalLessons = (e.course?.modules || []).reduce(
          (n: number, m: any) => n + (m.lessons?.length || 0),
          0
        );
        const completed = completedByCourse.get(e.course?.id)?.size || 0;
        const progress = totalLessons > 0 ? Math.round((completed / totalLessons) * 100) : 0;
        return { courseId: e.course?.slug, progress };
      }),
    };
  },
};
