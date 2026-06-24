import { factories } from '@strapi/strapi';
import { resolveSlugParam } from '../../../utils/scoped-find';
import { slugify, uniqueSlug } from '../../../utils/slugify';
import { cached, invalidateScope } from '../../../utils/cache';
import { logActivity } from '../../../utils/activity';

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

const withPostedAgo = (entity: any) => {
  if (!entity) return entity;
  if (Array.isArray(entity)) return entity.map(withPostedAgo);
  return { ...entity, postedAgo: timeAgo(entity.createdAt) };
};

export default factories.createCoreController('api::job.job', ({ strapi }) => ({
  // The admin Content Manager UI generates the `slug` uid field client-side before submit, so
  // it's never present when a job is created directly via the REST API (e.g. the admin frontend's
  // Server Action) — without this, required-field validation rejects the request before it ever
  // reaches a beforeCreate lifecycle.
  async create(ctx) {
    const body = ctx.request.body as any;
    if (body?.data?.title && !body.data.slug) {
      body.data.slug = await uniqueSlug(strapi, 'api::job.job', slugify(body.data.title));
    }
    const result = await super.create(ctx);
    await invalidateScope('jobs');

    // Public job board listens on /job-stream for this — only broadcast jobs visible to
    // the public (drafts are filtered out of `find`/`findOne` the same way for everyone else).
    const job = result?.data as any;
    if (job && job.status !== 'draft') {
      strapi.eventHub.emit('tv.job.created', {
        id: job.slug,
        title: job.title,
        org: job.org,
        orgKind: job.orgKind,
        field: job.field,
        location: job.location,
        locationType: job.locationType,
        type: job.type,
        level: job.level,
        pay: job.pay,
        postedAgo: timeAgo(job.createdAt),
      });
    }

    return result;
  },

  async update(ctx) {
    const result = await super.update(ctx);
    await invalidateScope('jobs');
    return result;
  },

  async delete(ctx) {
    const result = await super.delete(ctx);
    await invalidateScope('jobs');
    return result;
  },

  async find(ctx) {
    const isAdmin = ctx.state.user?.role?.name === 'Admin';
    if (!isAdmin) {
      ctx.query = {
        ...ctx.query,
        filters: {
          ...((ctx.query.filters as object) || {}),
          status: { $ne: 'draft' },
        },
      };
    }
    const { data, meta } = await cached<{ data: any; meta: any }>('jobs', JSON.stringify(ctx.query), 30, () => super.find(ctx));
    return { data: withPostedAgo(data), meta };
  },

  async findOne(ctx) {
    await resolveSlugParam(strapi, 'api::job.job', ctx);
    const response = await super.findOne(ctx);
    const isAdmin = ctx.state.user?.role?.name === 'Admin';
    if (response?.data && !isAdmin && response.data.status === 'draft') {
      return ctx.notFound();
    }
    return { data: withPostedAgo(response?.data), meta: response?.meta };
  },

  async apply(ctx) {
    const { slug } = ctx.params;
    const user = ctx.state.user;
    if (!user) return ctx.unauthorized('You must be signed in to apply.');

    const job = await strapi.db.query('api::job.job').findOne({ where: { slug } });
    if (!job) return ctx.notFound('Job not found.');
    if (job.status === 'closed') return ctx.badRequest('This job is no longer accepting applications.');

    const existing = await strapi.db.query('api::job-application.job-application').findOne({
      where: { job: job.id, user: user.id },
    });
    if (existing) return ctx.conflict('You have already applied to this job.');

    const body = (ctx.request.body as any)?.data
      ? JSON.parse((ctx.request.body as any).data)
      : ctx.request.body;
    const { name, whatsapp, message, portfolioUrl } = body || {};
    if (!name || !whatsapp) return ctx.badRequest('name and whatsapp are required.');

    const files = (ctx.request as any).files;
    const cv = files?.cv;

    const application = await strapi.entityService.create('api::job-application.job-application', {
      data: {
        job: job.id,
        user: user.id,
        name,
        whatsapp,
        message,
        portfolioUrl: portfolioUrl || undefined,
        status: 'Applied',
        ...(cv ? { cv } : {}),
      },
      files: cv ? { cv } : undefined,
    } as any);

    await logActivity(strapi, { who: name, what: `applied to ${job.title}`, kind: 'application' });

    ctx.body = { data: application };
  },

  // Public SSE stream of newly published jobs — pushed via strapi.eventHub so the job
  // board can live-insert new listings without polling or a page reload. Unauthenticated
  // on purpose: the payload only ever contains the same fields already public via GET /jobs.
  async stream(ctx) {
    ctx.request.socket.setTimeout(0);
    ctx.res.setHeader('Content-Type', 'text/event-stream');
    ctx.res.setHeader('Cache-Control', 'no-cache');
    ctx.res.setHeader('Connection', 'keep-alive');
    ctx.res.setHeader('X-Accel-Buffering', 'no');
    ctx.status = 200;
    ctx.respond = false;

    const send = (event: string, data: unknown) => {
      ctx.res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
    };
    send('connected', { ok: true });

    const unsubscribe = strapi.eventHub.on('tv.job.created', async (payload: unknown) => {
      send('job.created', payload);
    });

    const heartbeat = setInterval(() => ctx.res.write(': ping\n\n'), 20_000);

    ctx.req.on('close', () => {
      clearInterval(heartbeat);
      unsubscribe();
      ctx.res.end();
    });
  },
}));
